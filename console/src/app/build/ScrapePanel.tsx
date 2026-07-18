'use client';

import { useEffect, useState } from 'react';
import { Globe, Spinner, CheckCircle, Warning } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import { deepMerge } from '@/lib/merge';
import { VERTICAL_PRESETS, type VerticalId } from '@/lib/verticals';
import { ALL_SECTIONS } from '@/lib/copy-schema';

// "Seed from existing website" — rebuilt on Claude (replaces the old Firecrawl path).
// Claude's web_fetch tool reads the client's homepage server-side, extracts all brand
// copy/text, and returns a comprehensive content object. The result becomes the imported
// (base) content, so the whole preview reseeds from the site; the chosen vertical fills any
// gaps the site didn't cover.
//
// If an imported intake asked for a scrape (_meta.scrapeExistingWebsite), the URL is prefilled
// and a badge is shown. Scanning clears that flag so it won't re-prompt.

export default function ScrapePanel({
  imported,
  onImport,
  vertical,
  base,
}: {
  imported: SiteContent | null;
  onImport: (site: SiteContent) => void;
  vertical: VerticalId;
  base: SiteContent;
}) {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const requested = imported?._meta?.scrapeExistingWebsite === true;
  const prefill = imported?._meta?.scrapeWebsiteDomain ?? '';

  useEffect(() => {
    if (prefill) setUrl(prefill);
  }, [prefill]);

  async function onScan() {
    if (!url.trim()) return;
    setScanning(true);
    setError('');
    setNote('');
    try {
      const res = await fetch('/api/build/generate-copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vertical, base, url: url.trim(), sections: ALL_SECTIONS }),
      });
      const data = (await res.json()) as { generated?: Partial<SiteContent>; error?: string };
      if (!res.ok || !data.generated) throw new Error(data.error || `Scan failed (${res.status}).`);

      // Replace everything from the site: scan output over a fresh vertical preset.
      const merged = deepMerge(VERTICAL_PRESETS[vertical], data.generated) as SiteContent;
      const next: SiteContent = {
        ...merged,
        _meta: { ...merged._meta, scrapeExistingWebsite: false, scrapeWebsiteDomain: url.trim() },
      };
      onImport(next);

      const filled = Object.keys(data.generated).length;
      setNote(
        `Scanned ${url.trim()} — pulled content into ${filled} section${filled === 1 ? '' : 's'}. Remaining gaps fill from the ${vertical} vertical, and everything stays editable in the preview.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed.');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-uiCardRule bg-white p-6">
      <div className="flex items-center gap-2">
        <Globe size={16} weight="bold" className="text-uiInkSoft" />
        <p className="font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">
          Seed from existing website
        </p>
        {requested && (
          <span className="rounded-full border border-uiInk/15 bg-uiAccent px-2 py-0.5 font-chromeMono text-[10px] uppercase tracking-widest text-uiInk">
            client requested
          </span>
        )}
      </div>

      <p className="text-sm text-uiInkSoft">
        Claude reads the client&apos;s current homepage and rebuilds the whole preview from what it
        finds — brand, services, about, reviews, and contact details. Anything the site doesn&apos;t
        cover is written to match the selected vertical.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourbusiness.com"
          disabled={scanning}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-uiInk disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onScan}
          disabled={scanning || !url.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-uiInk px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-uiInk/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {scanning ? (
            <>
              <Spinner size={15} className="animate-spin" /> Scanning…
            </>
          ) : (
            <>
              <Globe size={15} /> Scan site
            </>
          )}
        </button>
      </div>

      {note && (
        <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle size={15} weight="fill" /> {note}
        </p>
      )}
      {error && (
        <span className="flex items-center gap-1.5 text-sm text-amber-700">
          <Warning size={15} /> {error}
        </span>
      )}
    </div>
  );
}
