'use client';

import { useState } from 'react';
import { UploadSimple, CheckCircle, Warning, X } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';

// Parses the onboarding JSON (emailed via Resend at end of onboarding) and hands a single
// SiteContent up to the builder. Accepts either an Intake envelope { sites: [ ... ] } or a
// bare SiteContent. No schema validation — missing fields are intentional and get filled
// from the selected industry vertical downstream.
//
// Seeding from an existing website lives in the separate ScrapePanel (the "Seed from website"
// tab on the Finalize page).

type Parsed =
  | { kind: 'envelope'; sites: SiteContent[] }
  | { kind: 'single'; site: SiteContent };

function parsePayload(text: string): Parsed {
  const data = JSON.parse(text) as unknown;
  if (data && typeof data === 'object' && Array.isArray((data as { sites?: unknown }).sites)) {
    const sites = (data as { sites: SiteContent[] }).sites;
    if (!sites.length) throw new Error('The file has an empty "sites" array.');
    return { kind: 'envelope', sites };
  }
  if (data && typeof data === 'object' && ('brand' in data || 'hero' in data)) {
    return { kind: 'single', site: data as SiteContent };
  }
  throw new Error('Unrecognized file — expected an onboarding JSON (an Intake envelope or a site schema).');
}

function brandName(site: SiteContent): string {
  return site?.brand?.name || site?.brand?.long || 'this site';
}

function missingCount(site: SiteContent): number {
  const m = site?._meta?.missing_fields;
  return Array.isArray(m) ? m.length : 0;
}

export default function ImportPanel({
  imported,
  onImport,
  onClear,
}: {
  imported: SiteContent | null;
  onImport: (site: SiteContent) => void;
  onClear: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [envelope, setEnvelope] = useState<SiteContent[] | null>(null);
  const [siteIdx, setSiteIdx] = useState(0);

  function ingest(raw: string) {
    setError('');
    try {
      const parsed = parsePayload(raw);
      if (parsed.kind === 'envelope') {
        if (parsed.sites.length > 1) {
          // Enterprise: let the user choose which site to load.
          setEnvelope(parsed.sites);
          setSiteIdx(0);
          return;
        }
        commit(parsed.sites[0]);
      } else {
        commit(parsed.site);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse the file.');
    }
  }

  function commit(site: SiteContent) {
    setEnvelope(null);
    setText('');
    onImport(site);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      ingest(await file.text());
    } catch {
      setError('Could not read that file.');
    }
    e.target.value = '';
  }

  return (
    <div className="space-y-4 rounded-lg border border-uiCardRule bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">
          Import onboarding JSON
        </p>
        {imported && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 font-chromeMono text-xs text-zinc-400 hover:text-zinc-700"
          >
            <X size={12} /> Clear import
          </button>
        )}
      </div>

      {imported ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle size={16} weight="fill" />
          Imported <span className="font-medium">{brandName(imported)}</span>
          {missingCount(imported) > 0 && (
            <span className="text-zinc-500">
              · {missingCount(imported)} field{missingCount(imported) === 1 ? '' : 's'} will be filled from the vertical
            </span>
          )}
        </p>
      ) : (
        <p className="text-sm text-zinc-500">
          Drop in the JSON emailed when a client finishes onboarding. Any fields it&apos;s missing
          are filled from the industry vertical you pick above.
        </p>
      )}

      {/* Enterprise multi-site chooser */}
      {envelope && (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">This file has {envelope.length} sites. Pick one to load:</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={siteIdx}
              onChange={(e) => setSiteIdx(Number(e.target.value))}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            >
              {envelope.map((s, i) => (
                <option key={i} value={i}>
                  {i + 1}. {brandName(s)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => commit(envelope[siteIdx])}
              className="rounded-md bg-uiInk px-3 py-1.5 text-sm font-medium text-white hover:bg-uiInk/90"
            >
              Load site
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:border-zinc-400">
          <UploadSimple size={16} />
          Choose JSON file
          <input type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
        </label>
        <span className="text-xs text-zinc-400">or paste below</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{ "sites": [ { "brand": { … }, "hero": { … } } ] }'
        rows={3}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 font-chromeMono text-xs text-zinc-700 outline-none focus:border-uiInk"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => ingest(text)}
          disabled={!text.trim()}
          className="rounded-md bg-uiInk px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-uiInk/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Import pasted JSON
        </button>
        {error && (
          <span className="flex items-center gap-1.5 text-sm text-amber-700">
            <Warning size={15} /> {error}
          </span>
        )}
      </div>
    </div>
  );
}
