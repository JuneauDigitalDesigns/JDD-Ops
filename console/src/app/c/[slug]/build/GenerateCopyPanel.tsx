'use client';
import { useState } from 'react';
import { Sparkle, CircleNotch, ArrowCounterClockwise, Warning, CheckCircle, Circle } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { VerticalId } from '@/lib/verticals';
import { ALL_SECTIONS, type Section } from '@/lib/copy-schema';
import { labelFor } from '@/lib/section-labels';

type State = { kind: 'idle' } | { kind: 'running' } | { kind: 'error'; message: string };

export default function GenerateCopyPanel({
  vertical, base, sections, onSectionsChange, details, onDetailsChange, scanUrl, onScanUrlChange,
  generated, onGenerated, onClearGenerated, onReviewSection,
}: {
  vertical: VerticalId;
  base: SiteContent;
  /** Sections ticked for the next run. Owned by the wizard bundle so it survives navigation. */
  sections: Section[];
  onSectionsChange: (v: Section[]) => void;
  details: string;
  onDetailsChange: (v: string) => void;
  scanUrl: string;
  onScanUrlChange: (v: string) => void;
  generated: Partial<SiteContent> | null;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  /** Open the read-only review modal for a section (click on a checklist item). */
  onReviewSection: (s: Section) => void;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  /** What the last run actually produced, vs what was asked for. See the note in run(). */
  const [lastRun, setLastRun] = useState<{ asked: Section[]; got: Section[] } | null>(null);

  async function run() {
    const asked = sections;
    setState({ kind: 'running' });
    setLastRun(null);
    try {
      const res = await fetch('/api/build/generate-copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vertical, base, details, sections: asked, url: scanUrl.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { generated?: Partial<SiteContent>; error?: string };
      if (!res.ok || !data.generated) {
        setState({ kind: 'error', message: data.error ?? 'Generation failed.' });
        return;
      }

      // The API chunks sections and only errors if EVERY chunk failed, so a 200 can come back
      // with fewer sections than were asked for. Since applyGenerated now MERGES, a section
      // that failed silently keeps its previous copy and would still read as "generated" —
      // so diff what came back and say so, leaving the failures ticked for a one-click retry.
      const got = asked.filter((s) => s in data.generated!);
      const failed = asked.filter((s) => !got.includes(s));
      setLastRun({ asked, got });

      onGenerated(data.generated);
      // Clear the selection on a clean run so a stray click can't re-roll accepted copy;
      // keep the failures ticked when there were any.
      onSectionsChange(failed);
      setState({ kind: 'idle' });
    } catch {
      setState({ kind: 'error', message: 'Could not reach the copy service.' });
    }
  }

  const busy = state.kind === 'running';
  // Every section the checklist offers. `sections` is now the SELECTION for the next run,
  // not the catalogue, so the list has to come from ALL_SECTIONS. (brand is an always-on
  // tagline rather than a listed section.)
  const sectionLabels = ALL_SECTIONS.filter((s) => s !== 'brand');
  // A section is "generated" once it appears in the generated layer.
  const isGen = (s: Section) => Boolean(generated && s in generated);
  const genCount = sectionLabels.filter(isGen).length;

  const picked = new Set(sections);
  const togglePick = (s: Section) =>
    onSectionsChange(picked.has(s) ? sections.filter((x) => x !== s) : [...sections, s]);
  const allPicked = sectionLabels.every((s) => picked.has(s));

  return (
    <div className="space-y-3 rounded-lg border border-uiCardRule bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">Generate brand copy</p>
        {generated && (
          <button
            type="button"
            onClick={onClearGenerated}
            className="inline-flex items-center gap-1 font-chromeMono text-xs text-zinc-400 hover:text-zinc-700"
          >
            <ArrowCounterClockwise size={12} /> Revert generated copy
          </button>
        )}
      </div>
      {/* Status checklist — grey = not yet written, teal accent = written. Compact 2-column. */}
      {sectionLabels.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">Brand copy</span>
              <span className="badge badge-accent">{vertical}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSectionsChange(allPicked ? [] : [...sectionLabels])}
                className="font-chromeMono text-xs text-zinc-400 hover:text-zinc-700"
              >
                {allPicked ? 'Select none' : 'Select all'}
              </button>
              <span className="font-chromeMono text-xs tabular-nums text-zinc-400">
                {genCount} / {sectionLabels.length}
              </span>
            </div>
          </div>
          {/* Checkbox picks the section for the next run; the label opens the review modal. */}
          <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {sectionLabels.map((s) => {
              const done = isGen(s);
              return (
                <li key={s} className="flex items-center gap-1.5 rounded px-1.5 py-1">
                  <input
                    type="checkbox"
                    checked={picked.has(s)}
                    onChange={() => togglePick(s)}
                    disabled={busy}
                    aria-label={`Regenerate ${labelFor(s)}`}
                    className="shrink-0 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => onReviewSection(s)}
                    aria-label={`Review ${labelFor(s)} copy`}
                    className={[
                      'flex min-w-0 flex-1 items-center gap-1.5 rounded text-left text-xs transition-colors hover:bg-black/[0.04]',
                      done ? 'text-accent' : 'text-zinc-400',
                    ].join(' ')}
                  >
                    {done ? <CheckCircle size={14} weight="fill" /> : <Circle size={14} />}
                    {labelFor(s)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <label className="block">
        <span className="field-label">Scan an existing site (optional)</span>
        <input
          type="text"
          value={scanUrl}
          onChange={(e) => onScanUrlChange(e.target.value)}
          placeholder="theirbusiness.com"
          disabled={busy}
          className="input disabled:opacity-50"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="font-chromeMono text-xs uppercase tracking-widest text-zinc-400">
          Additional brand details (optional)
        </span>
        <textarea
          value={details}
          onChange={(e) => onDetailsChange(e.target.value)}
          placeholder="Business name, city, what makes them different, tone/voice, services to emphasize…"
          rows={4}
          disabled={busy}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-uiInk"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy || sections.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-uiInk px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-uiInk/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <CircleNotch size={15} className="animate-spin" /> : <Sparkle size={15} weight="fill" />}
          {busy
            ? (scanUrl.trim() ? 'Scanning & generating…' : 'Generating…')
            : `${generated ? 'Regenerate' : 'Generate'} ${sections.length} section${sections.length === 1 ? '' : 's'}`}
        </button>

        {/* An empty selection is a legitimate resting state now — a clean run clears it — so
            the disabled button has to explain itself rather than just looking broken. */}
        {sections.length === 0 && !busy && (
          <span className="text-sm text-zinc-400">Tick the sections you want to regenerate.</span>
        )}

        {/* What the run actually produced. A 200 can carry fewer sections than were asked
            for, and since generated copy MERGES, a silent failure would otherwise look like
            success — the section keeps its old copy and still reads as generated. */}
        {lastRun && !busy && state.kind === 'idle' && (
          lastRun.got.length === lastRun.asked.length ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle size={15} weight="fill" />
              {lastRun.got.length === 1
                ? `Wrote ${labelFor(lastRun.got[0])}.`
                : `Wrote ${lastRun.got.length} sections.`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
              <Warning size={15} />
              Wrote {lastRun.got.length} of {lastRun.asked.length} —{' '}
              {lastRun.asked.filter((s) => !lastRun.got.includes(s)).map(labelFor).join(', ')}{' '}
              failed and kept previous copy. Still ticked, so Regenerate retries them.
            </span>
          )
        )}

        {state.kind === 'error' && (
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
            <Warning size={15} /> {state.message}
          </span>
        )}
      </div>
    </div>
  );
}
