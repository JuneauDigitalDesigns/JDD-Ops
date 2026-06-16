'use client';

import { useEffect, useState } from 'react';
import { Globe, Spinner, CheckCircle, Warning } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import { deepMerge } from '@/lib/merge';
import { mapScrapeToSiteContent, type ScrapedContent } from '@/data/firecrawl-schema';

// Standalone "Seed from existing website" section, rendered below ImportPanel on the Finalize
// page. Always available — usable with or without a prior import:
//   • With an import: scraped values fill gaps, the operator-provided intake values win.
//   • Without an import: the scrape becomes the imported content; the page-level
//     deepMerge(VERTICAL_PRESETS[vertical], imported) fills the rest from the chosen vertical.
// If the imported intake asked for a scrape (_meta.scrapeExistingWebsite), the URL is prefilled
// and a badge is shown. Scraping clears that flag so it won't re-prompt.

const TOTAL_CHECKS = 10; // mapScrapeToSiteContent tracks 10 key areas in _meta.missing_fields

export default function ScrapePanel({
  imported,
  onImport,
}: {
  imported: SiteContent | null;
  onImport: (site: SiteContent) => void;
}) {
  const [url, setUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const requested = imported?._meta?.scrapeExistingWebsite === true;
  const prefill = imported?._meta?.scrapeWebsiteDomain ?? '';

  // Prefill the URL when an import arrives carrying a requested domain.
  useEffect(() => {
    if (prefill) setUrl(prefill);
  }, [prefill]);

  async function onScrape() {
    if (!url.trim()) return;
    setScraping(true);
    setError('');
    setNote('');
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json()) as { url?: string; extracted?: ScrapedContent; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `Scrape failed (${res.status}).`);

      const usedUrl = data.url ?? url.trim();
      const mapped = mapScrapeToSiteContent(data.extracted ?? {}, usedUrl);

      // Scraped content is the floor; any operator-provided intake values override it.
      const merged = deepMerge(mapped as unknown as SiteContent, imported ?? ({} as SiteContent));
      const next: SiteContent = {
        ...merged,
        _meta: { ...merged._meta, scrapeExistingWebsite: false, scrapeWebsiteDomain: usedUrl },
      };
      onImport(next);

      const filled = TOTAL_CHECKS - (mapped._meta?.missing_fields?.length ?? TOTAL_CHECKS);
      setNote(
        filled > 0
          ? `Scraped ${usedUrl} — pulled content into ${filled} key area${filled === 1 ? '' : 's'}. Remaining gaps fill from the vertical.`
          : `Scraped ${usedUrl}, but found little structured content. Check the URL or fill fields manually.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scrape failed.');
    } finally {
      setScraping(false);
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
        Pull content, branding, and metadata from the client&apos;s current homepage as a starting
        point. Scraped values fill gaps only — anything an imported intake already provides is kept.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourbusiness.com"
          disabled={scraping}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-uiInk disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onScrape}
          disabled={scraping || !url.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-uiInk px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-uiInk/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {scraping ? (
            <>
              <Spinner size={15} className="animate-spin" /> Scraping…
            </>
          ) : (
            <>
              <Globe size={15} /> Scrape site
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
