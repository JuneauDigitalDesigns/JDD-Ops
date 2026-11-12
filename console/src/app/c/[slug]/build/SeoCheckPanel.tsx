'use client';

/**
 * The SEO check in the Export and Deploy dialogs (SEO plan D13): what scorePage finds in the
 * Studio's content, before the button is pressed. Blocking findings are the ones the export route
 * refuses on (dashes, numbers not in the client's facts, duplicate titles, a wrong canonical,
 * "near me", a service page that doesn't earn its page); the rest are listed to look at. The
 * export runs the same check on what it ships, so this is a preview of that, never a substitute.
 */
import { useMemo, useState } from 'react';
import type { SiteComposition } from '@/lib/pages';
import type { ServicePicks } from '@/lib/copyRisks';
import { seoFindings } from './seo-findings';

export default function SeoCheckPanel({
  content,
  composition,
  vertical,
  briefFacts = '',
  servicePicks,
}: {
  content: unknown;
  composition?: SiteComposition;
  vertical: string | null;
  /** The facts the copy brief gave the copywriter (copy-brief/brief-facts.ts). */
  briefFacts?: string;
  /** The service names and tags the intake picked: not preset copy (copyRisks.ts). */
  servicePicks?: ServicePicks;
}) {
  const score = useMemo(() => seoFindings(content, composition, vertical, briefFacts, servicePicks), [content, composition, vertical, briefFacts, servicePicks]);
  const [showSoft, setShowSoft] = useState(false);
  const blocking = score.hard.length > 0;

  return (
    <section
      className="rounded-md border px-4 py-3"
      style={blocking ? { borderColor: 'var(--danger)', background: 'var(--danger-glow)' } : undefined}
      aria-label="SEO check"
    >
      <h3 className="kicker mb-1.5" style={blocking ? { color: 'var(--danger)' } : undefined}>
        SEO check · {blocking ? `${score.hard.length} blocking` : 'nothing blocking'} · {score.soft.length} to look at
      </h3>
      {blocking && (
        <ul className="mb-2 list-disc space-y-1 pl-4 text-xs text-fg2">
          {score.hard.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
      {score.soft.length > 0 && (
        <>
          <button type="button" className="text-xs underline underline-offset-2" onClick={() => setShowSoft((v) => !v)} aria-expanded={showSoft}>
            {showSoft ? 'Hide findings' : 'Show findings'}
          </button>
          {showSoft && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-fg2">
              {score.soft.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
