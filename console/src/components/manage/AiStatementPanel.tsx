'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Robot, SpinnerGap, Warning, XCircle } from '@phosphor-icons/react';
import { useManage } from './ManageContext';
import type { AiStatementDiff } from '@/lib/aiStatementTypes';

interface Status {
  ok: boolean;
  reason?: string;
  masterBound?: boolean;
  llmId?: string;
  enabled?: boolean;
  live?: 'absent' | 'intact' | 'altered';
  drift?: boolean;
  sentence?: string | null;
  proposal?: {
    enabled: boolean;
    changed: boolean;
    hash: string;
    charsBefore: number;
    charsAfter: number;
    diff: AiStatementDiff;
  } | null;
}

/**
 * The per-client AI statement (contract v5.4): on a client's written request, the agent says it's
 * an AI near the start of each call.
 *
 * A change is always shown before it is made: the button only fetches the exact change against the
 * live prompt, and a second button applies that one. The live state is read from Retell every time
 * and "couldn't read" stays a message with no buttons, never a stale On or Off.
 */
export default function AiStatementPanel({ blocked, onChanged }: { blocked: boolean; onChanged: () => void }) {
  const { ctx, site, confirmWrite } = useManage();
  const [status, setStatus] = useState<Status | null>(null);
  const [preview, setPreview] = useState<NonNullable<Status['proposal']> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const url = useCallback(
    (want?: 'on' | 'off') => {
      const qs = new URLSearchParams({ slug: ctx.slug, site: site.slug, ...(want ? { want } : {}) });
      return `/api/manage/agent-prompt/ai-statement?${qs.toString()}`;
    },
    [ctx.slug, site.slug],
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url(), { cache: 'no-store' });
      const body = (await res.json()) as Status & { error?: string };
      setStatus(body.error ? { ok: false, reason: body.error } : body);
    } catch (err) {
      setStatus({ ok: false, reason: err instanceof Error ? err.message : 'Could not read the live agent.' });
    }
  }, [url]);

  useEffect(() => {
    setStatus(null);
    setPreview(null);
    setMessage(null);
    void refresh();
  }, [refresh]);

  async function showChange(want: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url(want ? 'on' : 'off'), { cache: 'no-store' });
      const body = (await res.json()) as Status & { error?: string };
      if (body.error || !body.ok || !body.proposal) {
        setMessage({ ok: false, text: body.error ?? body.reason ?? 'Could not prepare the change.' });
        return;
      }
      setPreview(body.proposal);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not prepare the change.' });
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!preview) return;
    const confirmed = await confirmWrite({
      title: `Turn the AI statement ${preview.enabled ? 'on' : 'off'}`,
      effect: `Changes the live Retell LLM prompt for ${site.slug}. Callers hear the change on their next call.`,
    });
    if (!confirmed) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/manage/agent-prompt/ai-statement', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, site: site.slug, enabled: preview.enabled, expectedHash: preview.hash }),
      });
      const body = (await res.json()) as { ok?: boolean; reason?: string; error?: string; llmId?: string; disk?: { error: string | null } };
      if (!body.ok) {
        setMessage({ ok: false, text: body.error ?? body.reason ?? 'The change failed.' });
      } else {
        const diskNote = body.disk?.error ? ` The live agent changed, but agent-prompt.txt could not be updated: ${body.disk.error}` : '';
        setMessage({ ok: !body.disk?.error, text: `AI statement ${preview.enabled ? 'on' : 'off'}. Retell LLM ${body.llmId} read back as sent.${diskNote}` });
        onChanged();
      }
      setPreview(null);
      await refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'The change failed.' });
    } finally {
      setBusy(false);
    }
  }

  const on = status?.enabled === true;
  const driftText =
    status?.drift && on
      ? status.live === 'absent'
        ? 'On for this client, but the live prompt does not have it.'
        : 'On for this client, but the line in the live prompt was changed.'
      : status?.drift
        ? 'Off for this client, but the live prompt has the line.'
        : null;

  return (
    <section className="panel mb-4 p-4" aria-label="AI statement">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Robot size={15} className="shrink-0" />
          <h3 className="text-sm font-medium">AI statement</h3>
          {status?.ok && <span className={`badge ${driftText ? 'badge-warn' : on ? 'badge-ok' : ''}`}>{on ? 'On' : 'Off'}</span>}
        </div>
        {status?.ok && !preview && (
          <div className="flex gap-2">
            {driftText && on && (
              <button type="button" className="btn btn-sm" disabled={busy || blocked} onClick={() => void showChange(true)}>
                Re-apply…
              </button>
            )}
            <button type="button" className="btn btn-sm" disabled={busy || blocked} onClick={() => void showChange(!on)}>
              {busy && <SpinnerGap size={13} className="animate-spin" />}
              {on ? 'Turn off…' : 'Turn on…'}
            </button>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-fg3">
        For a client who has asked in writing. The agent begins its first reply of each call with
        {status?.sentence ? <> &ldquo;{status.sentence}&rdquo;</> : ' this statement'}, after the recording notice.
        Each site has its own setting, and it stays through prompt edits and regeneration.
      </p>

      {!status && <p className="mt-2 text-xs text-fg3">Reading the live agent…</p>}
      {status && !status.ok && (
        <p className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: status.masterBound ? 'var(--danger)' : 'var(--fg-3)' }}>
          <Warning size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {status.reason}
        </p>
      )}
      {driftText && (
        <p className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: 'var(--warn)' }}>
          <Warning size={13} weight="fill" style={{ flexShrink: 0, marginTop: 2 }} /> {driftText}
        </p>
      )}
      {blocked && status?.ok && !preview && (
        <p className="mt-2 text-xs text-fg3">Save or undo the edits in the prompt below first.</p>
      )}

      {preview && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-fg2">
            {preview.changed
              ? `The exact change to the live prompt (LLM ${status?.llmId}), line ${preview.diff.line}. Nothing else in the prompt changes.`
              : 'The live prompt already matches. Only the stored setting changes.'}
          </p>
          {preview.changed && (
            <pre className="mono-field w-full overflow-x-hidden whitespace-pre-wrap" style={{ maxHeight: 280, overflowY: 'auto' }} aria-label="Change to the live prompt">
              {preview.diff.contextBefore.map((l, i) => <div key={`b${i}`} style={{ color: 'var(--fg-3)' }}>{`  ${l}`}</div>)}
              {preview.diff.removed.map((l, i) => <div key={`r${i}`} style={{ color: 'var(--danger)' }}>{`- ${l}`}</div>)}
              {preview.diff.added.map((l, i) => <div key={`a${i}`} style={{ color: 'var(--ok)' }}>{`+ ${l}`}</div>)}
              {preview.diff.contextAfter.map((l, i) => <div key={`c${i}`} style={{ color: 'var(--fg-3)' }}>{`  ${l}`}</div>)}
            </pre>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void apply()}>
              {busy && <SpinnerGap size={13} className="animate-spin" />}
              {preview.enabled ? 'Add to the live agent' : 'Remove from the live agent'}
            </button>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: message.ok ? undefined : 'var(--danger)' }}>
          {message.ok ? (
            <CheckCircle size={13} weight="fill" style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }} />
          ) : (
            <XCircle size={13} weight="fill" style={{ flexShrink: 0, marginTop: 2 }} />
          )}
          <span className={message.ok ? 'text-fg2' : undefined}>{message.text}</span>
        </p>
      )}
    </section>
  );
}
