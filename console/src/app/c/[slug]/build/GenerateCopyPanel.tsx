'use client';
import { useState } from 'react';
import { Sparkle, CircleNotch, ArrowCounterClockwise, Warning, CheckCircle } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { VerticalId } from '@/lib/verticals';
import type { Section } from '@/lib/copy-schema';
import { labelFor } from '@/lib/section-labels';

type State = { kind: 'idle' } | { kind: 'running' } | { kind: 'error'; message: string };

export default function GenerateCopyPanel({
  vertical, base, sections, onSectionsChange, details, onDetailsChange, clientDetails, scanUrl, onScanUrlChange,
  generated, onGenerated, onClearGenerated,
}: {
  vertical: VerticalId;
  base: SiteContent;
  /** Sections ticked for the next run. Owned by the wizard bundle so it survives navigation. */
  sections: Section[];
  onSectionsChange: (v: Section[]) => void;
  details: string;
  onDetailsChange: (v: string) => void;
  /**
   * The client's own onboarding answers, compiled to prose. Empty when they didn't fill in
   * the brand-direction step. Used to label the prefill and to offer a way back to it.
   */
  clientDetails: string;
  scanUrl: string;
  onScanUrlChange: (v: string) => void;
  generated: Partial<SiteContent> | null;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
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
          Brand details for the copywriter
        </span>
        <textarea
          value={details}
          onChange={(e) => onDetailsChange(e.target.value)}
          placeholder="What makes them different, who they sell to, tone of voice, services to emphasize…"
          rows={7}
          disabled={busy}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-uiInk"
        />
        {/* The client answered a brand-direction questionnaire at onboarding and until now
            nothing read it. Say where the text came from, and keep a way back to it — this
            box mixes their words with yours, so an edit shouldn't be one-way. */}
        {clientDetails && (
          <span className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {details === clientDetails
              ? "Prefilled from the client's onboarding answers."
              : "Edited — no longer matches the client's onboarding answers."}
            {details !== clientDetails && (
              <button
                type="button"
                onClick={() => onDetailsChange(clientDetails)}
                disabled={busy}
                className="inline-flex items-center gap-1 font-chromeMono hover:text-zinc-700"
              >
                <ArrowCounterClockwise size={11} /> Reset to their answers
              </button>
            )}
          </span>
        )}
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
