'use client';

/**
 * The Prompt step's run box (Xander, 2026-11-10, the approved "Prompt v2" mockup). It used to be a
 * 300px sidebar; now it is a small box floating in the bottom-right corner, just above the intake's
 * Back / Next bar, that steps through: the sections to write a group at a time (a switch beside
 * each name), the model and its estimated cost, and a summary over the Generate button.
 * The steps and their headers are lib/run-steps.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleNotch, Check, X, Warning, Sparkle } from '@phosphor-icons/react';
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { Section } from '@/lib/copy-schema';
import { labelFor } from '@/lib/section-labels';
import { setTickedSections } from '@/lib/copy-brief/mutations';
import { relativeTime } from '@/lib/relativeTime';
import { MODEL_OPTIONS, modelOption } from '@/lib/model-pricing';
import { RUN_STEPS, SWITCHABLE, runSummary, switchSection, generateLabel } from '@/lib/run-steps';
import { copyRequestBody, unreportedSections, SKIP_REASONS, type CopyPage } from '@/lib/copy-brief/run-sections';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

/** `skipped`: the run did not write it, or not all of it, and says why. Never shown as done. */
type SectionStatus = 'idle' | 'writing' | 'done' | 'failed' | 'skipped';
type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

/** Long generation runs are still just a few LLM calls, not an npm build — 90s idle is
 *  already generous, reused from DeployDialog's own watchdog constant for consistency. */
const IDLE_TIMEOUT_MS = 90_000;

export default function RunControls({
  vertical, base, imported, edits, brief, tickedSections, onBriefChange, model, onModelChange,
  onGenerated, onClearGenerated, hasGenerated, pages,
}: {
  vertical: string;
  base: SiteContent;
  imported: SiteContent | null;
  /** The operator's edits by path. Posted beside `base`, because the brief takes its facts from
   *  `imported` + `edits` and reads `base` for layout only (copy-brief/grounded.ts). */
  edits: Record<string, unknown>;
  brief: CopyBrief;
  tickedSections: Section[];
  onBriefChange: Update;
  model: string;
  onModelChange: (m: string) => void;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  hasGenerated: boolean;
  /** The live composition's pages besides Home. Posted as `subpages`, without which the route
   *  writes no page headers or page SEO at all (copy-brief/run-sections.ts). */
  pages: CopyPage[];
}) {
  const [stepAt, setStepAt] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, SectionStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skips, setSkips] = useState<Record<string, string>>({});
  const [run, setRun] = useState<RunState>({ kind: 'idle' });
  const [estimate, setEstimate] = useState<{ estInputTokens: number; estOutputTokens: number; estCostUsd: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ticked = new Set(tickedSections);
  const toggle = (s: Section) =>
    onBriefChange((b) => setTickedSections(b, switchSection(tickedSections, s, !ticked.has(s))));

  // Debounced token/cost estimate whenever the run inputs change.
  useEffect(() => {
    if (tickedSections.length === 0) { setEstimate(null); return; }
    if (estimateTimer.current) clearTimeout(estimateTimer.current);
    estimateTimer.current = setTimeout(() => {
      setEstimating(true);
      fetch('/api/build/estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(copyRequestBody({ vertical, base, imported, edits, brief, sections: tickedSections, model, pages })),
      })
        .then((r) => r.json())
        .then((data) => setEstimate(data.error ? null : data))
        .catch(() => setEstimate(null))
        .finally(() => setEstimating(false));
    }, 500);
    return () => { if (estimateTimer.current) clearTimeout(estimateTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- base/imported/brief are large objects; re-running on every keystroke elsewhere is the point, JSON.stringify above is what actually changes.
  }, [vertical, base, imported, edits, brief, tickedSections, model, pages]);

  async function generate() {
    setRun({ kind: 'running' });
    setErrors({});
    setSkips({});
    const initial: Record<string, SectionStatus> = {};
    for (const s of tickedSections) initial[s] = 'idle';
    setStatuses(initial);

    let res: Response;
    try {
      res = await fetch('/api/build/generate-copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(copyRequestBody({ vertical, base, imported, edits, brief, sections: tickedSections, model, pages })),
      });
    } catch {
      setRun({ kind: 'error', message: 'Could not reach the copy service.' });
      return;
    }
    if (!res.body) {
      setRun({ kind: 'error', message: 'No response stream from the copy service.' });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let sawDone = false;
    // What the stream said about each section, kept here as well as in state so the end of the run
    // can tell which switched-on sections it never mentioned.
    const reported: Record<string, string> = {};
    let idle: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const armWatchdog = () => {
      clearTimeout(idle);
      idle = setTimeout(() => { timedOut = true; reader.cancel().catch(() => {}); }, IDLE_TIMEOUT_MS);
    };
    armWatchdog();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        armWatchdog();
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let msg: { type: string; [k: string]: unknown };
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          if (msg.type === 'section') {
            const section = String(msg.section);
            reported[section] = String(msg.status);
            setStatuses((prev) => ({ ...prev, [section]: msg.status as SectionStatus }));
            if (msg.status === 'failed' && msg.error) {
              setErrors((prev) => ({ ...prev, [section]: String(msg.error) }));
            }
            if (msg.status === 'skipped') {
              setSkips((prev) => ({ ...prev, [section]: String(msg.error ?? SKIP_REASONS.unreported) }));
            }
          } else if (msg.type === 'done') {
            onGenerated(msg.generated as Partial<SiteContent>);
            sawDone = true;
          } else if (msg.type === 'error') {
            setRun({ kind: 'error', message: String(msg.message) });
          }
        }
      }
    } catch {
      /* reader cancelled by the watchdog, or the connection dropped */
    } finally {
      clearTimeout(idle);
    }

    // A switched-on section the finished run never mentioned was not written. Left blank it would
    // read as written, which is how the page headers went unnoticed (copy-brief/run-sections.ts).
    if (sawDone) {
      const unreported = unreportedSections(tickedSections, reported, SWITCHABLE);
      if (unreported.length) {
        setStatuses((prev) => ({ ...prev, ...Object.fromEntries(unreported.map((s) => [s, 'skipped' as const])) }));
        setSkips((prev) => ({ ...prev, ...Object.fromEntries(unreported.map((s) => [s, SKIP_REASONS.unreported])) }));
      }
    }

    if (timedOut) {
      setRun({ kind: 'error', message: 'The copy service stopped responding.' });
    } else if (sawDone) {
      setRun({ kind: 'done' });
    } else {
      setRun((prev) => (prev.kind === 'error' ? prev : { kind: 'error', message: 'The connection ended before generation finished.' }));
    }
  }

  const busy = run.kind === 'running';
  const step = RUN_STEPS[stepAt];
  const summary = runSummary(tickedSections);
  const cost = estimating ? 'estimating…' : estimate ? `~$${estimate.estCostUsd.toFixed(2)}` : '—';
  const failures = Object.entries(errors);
  const skipped = Object.entries(skips);

  return (
    <div
      data-testid="run-box"
      className="absolute bottom-3.5 right-6 z-10 flex h-[316px] w-[340px] flex-col overflow-hidden rounded-[14px] border border-ruleStrong bg-panel shadow-overlay"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-uiCardRule px-2.5 pb-2 pt-2.5">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => setStepAt((i) => Math.max(0, i - 1))}
          disabled={stepAt === 0}
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-uiCardRule bg-uiBg text-uiInk disabled:opacity-30"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <p className="truncate font-display text-[19px] font-bold leading-none text-uiInk">{step.label}</p>
          <div className="flex gap-1" aria-hidden>
            {RUN_STEPS.map((s, i) => (
              <i key={s.label} className={`block h-[3px] w-3.5 rounded-sm ${i === stepAt ? 'bg-uiAccent' : 'bg-uiCardRule'}`} />
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-label="Next"
          onClick={() => setStepAt((i) => Math.min(RUN_STEPS.length - 1, i + 1))}
          disabled={stepAt === RUN_STEPS.length - 1}
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-uiCardRule bg-uiBg text-uiInk disabled:opacity-30"
        >
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3.5 pb-3 pt-1.5">
        {step.kind === 'sections' && step.sections.map((s) => {
          const on = ticked.has(s);
          return (
            <div key={s} className="flex h-11 items-center gap-2.5 border-b border-uiCardRule last:border-b-0">
              <span className={`text-sm ${on ? 'font-semibold text-uiInk' : 'text-uiFg3'}`}>{labelFor(s)}</span>
              <StatusIcon status={statuses[s] ?? 'idle'} />
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={labelFor(s)}
                onClick={() => toggle(s)}
                disabled={busy}
                className="relative ml-auto inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
                style={{ background: on ? 'var(--ui-accent)' : 'var(--ui-rule-strong)' }}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full bg-panel transition-transform"
                  style={{ transform: on ? 'translateX(19px)' : 'translateX(3px)' }}
                />
              </button>
            </div>
          );
        })}

        {step.kind === 'model' && (
          <>
            <div role="radiogroup" aria-label="Model">
              {MODEL_OPTIONS.map((m) => (
                <label key={m.id} className={`flex h-9 cursor-pointer items-center gap-2.5 text-sm ${m.id === model ? 'font-semibold text-uiInk' : 'text-uiFg2'}`}>
                  <input
                    type="radio"
                    name="copy-model"
                    value={m.id}
                    checked={m.id === model}
                    onChange={() => onModelChange(m.id)}
                    disabled={busy}
                    className="accent-[var(--ui-accent)]"
                  />
                  {m.label}
                </label>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t border-uiCardRule pt-2.5">
              <p className="kicker w-full">Estimated cost</p>
              <p className="font-display text-[26px] font-bold leading-none text-uiInk">{cost}</p>
              {estimate && !estimating && (
                <p className="mono text-2xs text-uiFg3">
                  ~{estimate.estInputTokens.toLocaleString()} in / ~{estimate.estOutputTokens.toLocaleString()} out
                </p>
              )}
            </div>
            <button type="button" onClick={() => setStepAt(RUN_STEPS.length - 1)} className="btn btn-sm mt-auto self-end">
              Next: Summary <ArrowRight size={14} />
            </button>
          </>
        )}

        {step.kind === 'summary' && (
          <>
            <dl className="flex flex-col gap-1.5 pt-1.5 text-[13px] text-uiFg2">
              <SummaryLine term="Sections" value={`${summary.on} of ${summary.of}`} />
              {summary.off.length > 0 && <SummaryLine term="Off" value={summary.off.join(', ')} />}
              <SummaryLine term="Model" value={modelOption(model).label} />
              <SummaryLine term="Estimated cost" value={cost} />
            </dl>
            <div className="mt-2 flex min-h-0 flex-col gap-1 overflow-hidden">
              {run.kind === 'done' && (
                <p className="flex items-center gap-1.5 text-xs text-ok">
                  <Check size={14} weight="bold" /> Copy applied — review it on the next stage.
                </p>
              )}
              {run.kind === 'error' && (
                <p className="flex items-center gap-1.5 text-xs text-danger">
                  <Warning size={14} className="shrink-0" /> <span className="truncate">{run.message}</span>
                </p>
              )}
              {run.kind !== 'idle' && failures.map(([s, msg]) => (
                <p key={s} className="truncate text-2xs text-danger">{labelFor(s as Section)}: {msg}</p>
              ))}
              {run.kind !== 'idle' && skipped.map(([s, msg]) => (
                <p key={s} className="truncate text-2xs text-warn" title={msg}>{labelFor(s as Section)}: {msg}</p>
              ))}
              {/* `lastRunAt` is stamped on approve, not on generate, so this reads "last
                  approved" rather than "last generated". */}
              {!busy && (brief.lastRunAt || hasGenerated) && (
                <div className="flex items-center justify-between gap-2">
                  {brief.lastRunAt ? (
                    <p className="mono text-2xs text-uiInkSoft">Last approved {relativeTime(brief.lastRunAt)}</p>
                  ) : <span />}
                  {hasGenerated && (
                    <button type="button" onClick={onClearGenerated} className="mono text-2xs text-uiInkSoft hover:text-uiInk">
                      Revert generated copy
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={generate}
              disabled={busy || summary.on === 0}
              className="btn btn-primary mt-auto h-[42px] w-full shrink-0 justify-center"
            >
              {busy ? <CircleNotch size={15} className="animate-spin" /> : <Sparkle size={15} weight="fill" />}
              {/* Switched-on sections only: tickedSections also holds the per-page review keys
                  ("about:subpages"), which the route does not run, so its length overstated the run
                  and, with no section on, enabled a button that would have written every section. */}
              {busy ? 'Generating…' : generateLabel(summary.on, hasGenerated)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryLine({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0">{term}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-uiInk" title={value}>{value}</dd>
    </div>
  );
}

function StatusIcon({ status }: { status: SectionStatus }) {
  if (status === 'writing') return <CircleNotch size={13} className="shrink-0 animate-spin text-uiInkSoft" />;
  if (status === 'done') return <Check size={13} weight="bold" className="shrink-0 text-ok" />;
  if (status === 'failed') return <X size={13} weight="bold" className="shrink-0 text-danger" />;
  if (status === 'skipped') return <Warning size={13} weight="bold" className="shrink-0 text-warn" aria-label="Not written" />;
  return null;
}
