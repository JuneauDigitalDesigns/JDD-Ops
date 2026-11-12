'use client';

/**
 * Step 10, Review: generated copy, one section at a time. Pages and sections on the left,
 * the selected section's wireframe (Accept / Re-roll / Revert, click-to-edit) in the middle.
 * Replaces the long page of every section on every page (8,078 px at 1440×900).
 *
 * The gate is unchanged: a section that was generated and is still ticked for regeneration
 * hasn't been read, and blocks Approve, which now sits on Still to do.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleNotch, Sparkle, Warning } from '@phosphor-icons/react';
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { verdictKey, type Section, type VerdictKey } from '@/lib/copy-schema';
import { buildReviewGroups, type ReviewPage } from '@/lib/copy-review-groups';
import { labelFor } from '@/lib/section-labels';
import { getPath } from '@/lib/merge';
import { EditProvider, E } from '@/lib/editable';
import { copyRequestBody } from '@/lib/copy-brief/run-sections';
import { readCopyStream } from '@/lib/copy-brief/read-copy-stream';
import { sectionParts, applyParts, partsWord, type Part } from '@/lib/review-parts';
import { SectionReviewCard, VerdictBar, type SectionVerdict } from '../CopyWireframe';
import { Card, StatusMark, Tag } from './ui';

/** What a part regeneration posts besides the content: the same inputs the Prompt step's run uses. */
export type ReviewRun = {
  vertical: string;
  imported: SiteContent | null;
  edits: Record<string, unknown>;
  brief: CopyBrief;
  model: string;
};

export default function ReviewBoard({
  content, setField, verdictFor, pages, unreviewed, hasGenerated, focusSection, focusRoute, focusKey, generated, run,
}: {
  content: SiteContent;
  setField: (path: string, value: unknown) => void;
  /** The generated layer: a section's tickable parts are the text it holds. */
  generated: Partial<SiteContent> | null;
  run: ReviewRun;
  verdictFor: (key: VerdictKey) => SectionVerdict;
  pages: ReviewPage[];
  unreviewed: Set<VerdictKey>;
  hasGenerated: boolean;
  /** A section Still to do jumped to (a copy risk): open it. `focusKey` re-applies a repeat jump. */
  focusSection?: string;
  focusRoute?: string;
  focusKey?: number;
}) {
  const groups = useMemo(() => buildReviewGroups(pages), [pages]);
  const flat = useMemo(
    () => groups.flatMap((g, gi) => g.sections.map((s) => ({ gi, section: s, route: g.route || undefined, key: verdictKey(s, g.route || undefined) }))),
    [groups],
  );
  const [gi, setGi] = useState(0);
  const [key, setKey] = useState<VerdictKey | null>(null);

  // A jump from Still to do wins: open that section (a subpage header by its route).
  useEffect(() => {
    if (!focusSection) return;
    const hit = flat.find((f) => f.section === focusSection && (focusRoute ? f.route === focusRoute : !f.route))
      ?? flat.find((f) => f.section === focusSection);
    if (hit) { setKey(hit.key); setGi(hit.gi); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSection, focusRoute, focusKey]);

  // Open on the first section still to review, else the first section.
  useEffect(() => {
    if (key && flat.some((f) => f.key === key)) return;
    // A jump set the key in this same commit; this default must not overwrite it.
    if (focusSection && flat.some((f) => f.section === focusSection)) return;
    const first = flat.find((f) => unreviewed.has(f.key)) ?? flat[0];
    if (first) { setKey(first.key); setGi(first.gi); }
  }, [flat, unreviewed, key]);

  const pos = Math.max(0, flat.findIndex((f) => f.key === key));
  const cur = flat[pos];
  const group = groups[gi];
  function go(n: number) {
    const f = flat[n];
    if (!f) return;
    setKey(f.key);
    setGi(f.gi);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 px-6 py-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
        <h2 className="font-display text-[28px] font-bold leading-none text-uiInk">Review</h2>
        <span className="text-xs text-uiFg3">One section at a time.</span>
        <span className="ml-auto font-chromeMono text-2xs" style={{ color: unreviewed.size ? 'var(--warn)' : 'var(--ok)' }}>
          {!hasGenerated ? 'Nothing generated yet' : unreviewed.size ? `${unreviewed.size} to review` : 'All reviewed'}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[270px_minmax(0,1fr)]">
        <Card
          title={
            <span className="flex flex-wrap gap-1">
              {groups.map((g, k) => {
                const n = g.sections.filter((s) => unreviewed.has(verdictKey(s, g.route || undefined))).length;
                return (
                  <button
                    key={g.route || 'home'}
                    type="button"
                    onClick={() => { setGi(k); const f = flat.find((x) => x.gi === k); if (f) setKey(f.key); }}
                    className={`rounded-md px-2 py-0.5 font-chrome text-xs normal-case tracking-normal ${k === gi ? 'bg-uiInk text-uiCanvas' : 'text-uiFg2 hover:bg-uiSurface'}`}
                    style={k === gi ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : undefined}
                  >
                    {g.label}{n > 0 ? ` · ${n}` : ''}
                  </button>
                );
              })}
            </span>
          }
        >
          <ul>
            {group?.sections.map((s) => {
              const k = verdictKey(s, group.route || undefined);
              const open = unreviewed.has(k);
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => setKey(k)}
                    aria-current={k === key ? 'true' : undefined}
                    className={`flex h-10 w-full items-center gap-2.5 border-l-[3px] px-3.5 text-left text-[13.5px] ${k === key ? 'border-uiAccent bg-uiSurface font-semibold' : 'border-transparent hover:bg-uiSurface/60'}`}
                  >
                    <StatusMark ok={!open} />
                    {labelFor(s)}
                    <span className="ml-auto">{open ? <Tag tone="warn">To review</Tag> : null}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex min-h-0 flex-col gap-2">
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
            {cur && (() => {
              // Accept moves straight on to the next section (Xander, 2026-11-12).
              const v = verdictFor(cur.key);
              const verdict: SectionVerdict = { ...v, onAccept: () => { v.onAccept(); go(pos + 1); } };
              const parts = sectionParts(cur.key, generated, content);
              return parts.length ? (
                <PartsCard
                  key={cur.key}
                  section={cur.section}
                  sectionKey={cur.key}
                  parts={parts}
                  content={content}
                  generated={generated}
                  setField={setField}
                  verdict={verdict}
                  run={run}
                  pages={pages}
                />
              ) : (
                <SectionReviewCard
                  key={cur.key}
                  section={cur.section}
                  route={cur.route}
                  content={content}
                  setField={setField}
                  verdict={verdict}
                />
              );
            })()}
          </div>
          <div className="flex shrink-0 items-center justify-between">
            <button type="button" className="btn btn-sm" disabled={pos === 0} onClick={() => go(pos - 1)}>
              <ArrowLeft size={13} /> {flat[pos - 1] ? labelFor(flat[pos - 1].section) : 'Previous'}
            </button>
            <span className="font-chromeMono text-2xs text-uiFg3">{pos + 1} of {flat.length}</span>
            <button type="button" className="btn btn-sm" disabled={pos >= flat.length - 1} onClick={() => go(pos + 1)}>
              {flat[pos + 1] ? labelFor(flat[pos + 1].section) : 'Next'} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A generated section as its parts, each with a tick box (approved on the canvas, row 7). Ticking
 * parts brings up a bar to regenerate just those; the run is the existing copy route for this one
 * section, and only the ticked parts are taken from it (lib/review-parts.ts). Each part's text is
 * still click-to-edit.
 */
function PartsCard({
  section, sectionKey, parts, content, generated, setField, verdict, run, pages,
}: {
  section: Section;
  sectionKey: VerdictKey;
  parts: Part[];
  content: SiteContent;
  generated: Partial<SiteContent> | null;
  setField: (path: string, value: unknown) => void;
  verdict: SectionVerdict;
  run: ReviewRun;
  pages: ReviewPage[];
}) {
  const [marked, setMarked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (p: string) => setMarked((m) => (m.includes(p) ? m.filter((x) => x !== p) : [...m, p]));

  async function regenerate() {
    setBusy(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch('/api/build/generate-copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(copyRequestBody({
          vertical: run.vertical, base: content, imported: run.imported, edits: run.edits, brief: run.brief,
          sections: [section], model: run.model, pages,
        })),
      });
    } catch {
      setBusy(false);
      setError('Could not reach the copy service.');
      return;
    }
    const out = await readCopyStream(res);
    setBusy(false);
    if (!out.generated) { setError(out.error ?? null); return; }
    const w = applyParts(generated, out.generated, marked, run.edits);
    verdict.onApplyParts?.({ sections: w.sections, edits: w.edits });
    // A part the run did not return stays ticked, so nothing reads as rewritten that was not.
    setMarked(w.missing);
  }

  return (
    <EditProvider setField={setField}>
      <div className="relative flex min-h-full flex-col rounded-xl border border-uiCardRule bg-uiBg p-5 pb-20 shadow-raised" data-testid="review-parts" data-key={sectionKey}>
        <VerdictBar section={section} verdict={verdict} />
        <ul className="flex flex-col gap-0.5">
          {parts.map((p) => {
            const on = marked.includes(p.path);
            const value = getPath(content, p.path);
            return (
              <li
                key={p.path}
                className={`grid grid-cols-[26px_150px_minmax(0,1fr)] items-start gap-2.5 rounded-[9px] px-2 py-2 ${on ? 'bg-[rgba(31,111,120,.08)] outline outline-1 outline-[rgba(31,111,120,.35)]' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={busy}
                  onChange={() => toggle(p.path)}
                  aria-label={p.label}
                  className="mt-1 h-[18px] w-[18px] accent-[var(--ui-accent)]"
                />
                <span className="pt-1 font-chromeMono text-[10.5px] uppercase tracking-[0.12em] text-uiFg3">{p.label}</span>
                {busy && on ? (
                  <span className="flex flex-col gap-1.5 py-1" aria-hidden>
                    <i className="block h-3 w-11/12 animate-pulse rounded bg-[rgba(31,111,120,.18)]" />
                    <i className="block h-3 w-3/5 animate-pulse rounded bg-[rgba(31,111,120,.18)]" />
                  </span>
                ) : (
                  <span className="text-[14.5px] leading-snug text-uiInk"><E p={p.path}>{typeof value === 'string' ? value : ''}</E></span>
                )}
              </li>
            );
          })}
        </ul>
        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-danger"><Warning size={14} className="shrink-0" /> {error}</p>
        )}
        {marked.length > 0 && (
          <div className="absolute inset-x-4 bottom-3.5 flex items-center gap-3 rounded-xl bg-uiInk py-2.5 pl-4 pr-3 text-[#f4ecd8] shadow-overlay">
            <span className="font-semibold">{busy ? <>Regenerating {partsWord(marked.length)}…</> : <>{partsWord(marked.length)} marked</>}</span>
            {!busy && (
              <button type="button" onClick={() => setMarked([])} className="btn btn-sm ml-auto border-[rgba(244,236,216,.35)] bg-transparent text-[#f4ecd8]">
                Clear
              </button>
            )}
            <button type="button" onClick={regenerate} disabled={busy} className={`btn btn-sm btn-primary ${busy ? 'ml-auto' : ''}`}>
              {busy ? <CircleNotch size={14} className="animate-spin" /> : <Sparkle size={14} weight="fill" />}
              Regenerate {partsWord(marked.length)}
            </button>
          </div>
        )}
      </div>
    </EditProvider>
  );
}
