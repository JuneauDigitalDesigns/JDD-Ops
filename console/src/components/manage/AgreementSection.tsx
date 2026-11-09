'use client';

import { useCallback, useEffect, useState } from 'react';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';

/**
 * The agreement behind a phone close: the call it was accepted on, what was read, and the
 * recording. A recording usually isn't ready until after the call, so this is where it gets
 * attached (Xander, 2026-11-09). An attached recording can't be replaced, because a hash that can
 * be swapped later proves nothing, so attaching asks first.
 */

interface CallDetails {
  callRef: string;
  operator: string;
  scriptVersion: string;
  scriptHash: string;
  termsHash: string;
  recordingConsentAt: string | null;
  recordingStoppedAt: string | null;
  recording: { fileName: string; sizeBytes: number; sha256: string; attachedAt: string } | null;
}

interface Row {
  orderId: string;
  agreement: {
    method: 'read-aloud' | 'agreement-link';
    acceptedAt: string;
    signerName: string;
    signerTitle: string;
    version: string;
    call: CallDetails | null;
  };
}

const when = (iso: string | null) =>
  iso ? `${new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'America/New_York' })} ET` : '—';

function fileSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-xs text-fg3">{label}</dt>
      <dd className={`m-0 min-w-0 break-words text-sm text-fg ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </>
  );
}

/** XHR rather than fetch, for upload progress on a file that can take minutes. */
function sendFile(url: string, file: File, onProgress: (pct: number) => void): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('content-type', file.type);
    xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body: { error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* the status decides */
      }
      resolve({ ok: xhr.status < 300, error: body.error ?? `Upload failed (${xhr.status}).` });
    };
    xhr.onerror = () => resolve({ ok: false, error: 'The upload was interrupted.' });
    xhr.send(file);
  });
}

export default function AgreementSection() {
  const { ctx, site, confirmWrite } = useManage();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ orderId: string; pct: number } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/manage/agreement?site=${encodeURIComponent(site.slug)}`, { cache: 'no-store' });
      const body = (await res.json()) as { agreements?: Row[]; error?: string };
      if (!res.ok) {
        setRows([]);
        return setError(body.error ?? 'Could not read the agreement.');
      }
      setRows(body.agreements ?? []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Could not read the agreement.');
    }
  }, [site.slug]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  async function attach(orderId: string, file: File) {
    const ok = await confirmWrite({
      title: `Attach ${file.name}`,
      effect: `Uploads this ${fileSize(file.size)} file to private storage and records its SHA-256 on the agreement. An attached recording can't be replaced.`,
    });
    if (!ok) return;
    setError(null);
    setProgress({ orderId, pct: 0 });
    const result = await sendFile(
      `/api/manage/agreement/upload/${encodeURIComponent(orderId)}?slug=${encodeURIComponent(ctx.slug)}`,
      file,
      (pct) => setProgress({ orderId, pct }),
    );
    setProgress(null);
    if (!result.ok) return setError(result.error ?? 'Upload failed.');
    await load();
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader title="Agreement" lede="Accepted terms from a phone close, the call, and its recording." />

      {error && (
        <p role="alert" className="mb-4 text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      {rows === null && <p className="text-xs text-fg3">Reading the agreement…</p>}
      {rows?.length === 0 && !error && <p className="text-sm text-fg2">No phone-close agreement on this site.</p>}

      {rows?.map(({ orderId, agreement: a }) => {
        const call = a.call;
        const uploading = progress?.orderId === orderId;
        return (
          <section key={orderId} className="panel mb-4 flex flex-col gap-4 p-5">
            <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Terms {a.version}</h2>

            <dl className="grid grid-cols-[170px_minmax(0,1fr)] gap-x-4 gap-y-2">
              <Fact label="Accepted" value={when(a.acceptedAt)} />
              <Fact label="Accepted by" value={`${a.signerName}, ${a.signerTitle}`} />
              <Fact label="Method" value={a.method === 'read-aloud' ? 'Read aloud' : 'Agreement link'} />
              {call && (
                <>
                  <Fact label="Call reference" value={call.callRef} />
                  <Fact label="Operator" value={call.operator} />
                  <Fact label="Script version" value={call.scriptVersion} />
                  <Fact label="Script hash" value={call.scriptHash} mono />
                  <Fact label="Terms hash" value={call.termsHash} mono />
                  <Fact label="Recording consent" value={when(call.recordingConsentAt)} />
                  <Fact label="Recording stopped" value={when(call.recordingStoppedAt)} />
                </>
              )}
              {call?.recording && (
                <>
                  <Fact label="Recording" value={`${call.recording.fileName} (${fileSize(call.recording.sizeBytes)})`} />
                  <Fact label="Recording SHA-256" value={call.recording.sha256} mono />
                  <Fact label="Attached" value={when(call.recording.attachedAt)} />
                </>
              )}
            </dl>

            <div className="flex flex-wrap items-center gap-2.5">
              <a className="btn" href={`/api/sales/orders/${orderId}/agreement-pdf`} target="_blank" rel="noopener noreferrer">
                Open agreement
              </a>
              {call?.recording && (
                <a className="btn" href={`/api/sales/orders/${orderId}/recording`}>
                  Download recording
                </a>
              )}
              {call?.recordingConsentAt && !call.recording && (
                <label className="btn" style={uploading ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
                  {uploading ? `Uploading ${progress?.pct ?? 0}%` : 'Attach recording'}
                  <input
                    type="file"
                    accept="video/*,audio/*"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void attach(orderId, file);
                    }}
                  />
                </label>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
