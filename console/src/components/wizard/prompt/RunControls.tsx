'use client';

/**
 * The Prompt step's run menu (Xander, 2026-11-12, approved as the canvas's row 6). A button floats
 * in the bottom-right corner; pressed, it opens one window over the prompt with every section's
 * switch (the four groups side by side), the model, the summary and Generate. During a run each
 * section shows where it is (Waiting, Writing, Done, Failed, Not written) and a finished section
 * shows its first lines as they arrive (copy-brief/section-preview.ts, sent by the route).
 *
 * It replaced the small box that stepped through the same things a group at a time (2026-11-10).
 * The groups, their headers and the status words are lib/run-steps.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { CircleNotch, Check, X, Warning, Sparkle } from '@phosphor-icons/react';
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { Section } from '@/lib/copy-schema';
import { labelFor } from '@/lib/section-labels';
import { setTickedSections } from '@/lib/copy-brief/mutations';
import { relativeTime } from '@/lib/relativeTime';
import { MODEL_OPTIONS, modelOption } from '@/lib/model-pricing';
import { RUN_GROUPS, SWITCHABLE, runSummary, switchSection, generateLabel, runProgress, statusLabel, MENU_LABEL, RUNNING_LABEL } from '@/lib/run-steps';
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
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  /** Each finished section's first lines, as the run sends them (copy-brief/section-preview.ts). */
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, SectionStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skips, setSkips] = useState<Record<string, string>>({});
  const [run, setRun] = useState<RunState>({ kind: 'idle' });
  const [estimate, setEstimate] = useState<{ estInputTokens: number; estOutputTokens: number; estCostUsd: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ticked = new Set(tickedSections);
  const toggle = (s: Section) => {
    // A changed switch starts a new run's worth of choices: the last run's marks stop applying.
    if (run.kind !== 'idle' && run.kind !== 'running') { setRun({ kind: 'idle' }); setStatuses({}); setPreviews({}); setErrors({}); setSkips({}); }
    onBriefChange((b) => setTickedSections(b, switchSection(tickedSections, s, !ticked.has(s))));
  };

  // The menu covers the prompt: Escape closes it, and focus starts on Close.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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
    setPreviews({});
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
            if (msg.status === 'done' && typeof msg.preview === 'string' && msg.preview) {
              setPreviews((prev) => ({ ...prev, [section]: msg.preview as string }));
            }
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
  const summary = runSummary(tickedSections);
  const cost = estimating ? 'estimating…' : estimate ? `~$${estimate.estCostUsd.toFixed(2)}` : '—';
  const onSections = SWITCHABLE.filter((s) => ticked.has(s));
  const progress = runProgress(statuses, onSections);
  // A run's marks show from Generate until a switch is changed again.
  const showRun = run.kind !== 'idle';

  return (
    <>
      <button
        type="button"
        data-testid="run-menu-button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="absolute bottom-4 right-6 z-10 flex h-12 items-center gap-2.5 rounded-full bg-[#d2542f] px-5 text-[15px] font-semibold text-[#f4ecd8] shadow-[0_12px_28px_rgba(210,84,47,.35),0_2px_6px_rgba(20,18,12,.15)] transition-transform hover:-translate-y-0.5"
      >
        {busy ? <CircleNotch size={16} className="animate-spin" /> : <Sparkle size={16} weight="fill" />}
        {MENU_LABEL}
        <span className="rounded-full bg-[rgba(244,236,216,.22)] px-2.5 py-0.5 font-chromeMono text-xs">
          {busy ? `${progress.done}/${progress.of}` : summary.on}
        </span>
      </button>

      {open && (
        <div className="absolute inset-0 z-20" data-testid="run-menu">
          <div className="absolute inset-0 bg-[rgba(20,18,12,.38)]" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="run-menu-title"
            className="absolute inset-x-6 inset-y-3.5 flex flex-col overflow-hidden rounded-2xl border border-ruleStrong bg-panel shadow-overlay"
          >
            <div className="flex shrink-0 items-center gap-3.5 border-b border-uiCardRule px-5 py-4">
              <h3 id="run-menu-title" className="font-display text-[30px] font-bold leading-none text-uiInk">
                {busy ? RUNNING_LABEL : MENU_LABEL}
              </h3>
              {showRun && (
                <>
                  <span className="font-chromeMono text-[13px] text-uiFg3">{progress.done} of {progress.of} sections</span>
                  <span className="h-1.5 w-56 overflow-hidden rounded-full bg-uiCardRule" aria-hidden>
                    <i className="block h-full bg-uiAccent transition-[width]" style={{ width: `${progress.of ? (100 * progress.done) / progress.of : 0}%` }} />
                  </span>
                </>
              )}
              <button
                ref={closeRef}
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="ml-auto flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-uiCardRule text-uiInk hover:border-uiAccent"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[repeat(4,minmax(0,1fr))_330px]">
              {RUN_GROUPS.map((g) => (
                <div key={g.label} className="flex min-h-0 flex-col overflow-hidden border-r border-uiCardRule px-4 py-4">
                  <p className="mb-2 font-display text-[20px] font-bold leading-tight text-uiInk">{g.label}</p>
                  {g.sections.map((s) => {
                    const on = ticked.has(s);
                    const status = statuses[s];
                    const note = errors[s] || skips[s];
                    return (
                      <div key={s} className="flex min-h-[52px] flex-col justify-center gap-1 border-b border-uiCardRule/70 py-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[14.5px] ${on ? 'font-semibold text-uiInk' : 'text-uiFg3'}`}>{labelFor(s)}</span>
                          <span className="ml-auto flex shrink-0 items-center gap-2.5">
                          {(busy || (showRun && on && status && status !== 'idle')) && <StatusTag status={status} on={on} />}
                          {!busy && (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={on}
                              aria-label={labelFor(s)}
                              onClick={() => toggle(s)}
                              className="relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors"
                              style={{ background: on ? 'var(--ui-accent)' : 'var(--ui-rule-strong)' }}
                            >
                              <span
                                className="inline-block h-4 w-4 rounded-full bg-panel transition-transform"
                                style={{ transform: on ? 'translateX(19px)' : 'translateX(3px)' }}
                              />
                            </button>
                          )}
                          </span>
                        </div>
                        {showRun && status === 'done' && previews[s] && (
                          <p className="line-clamp-2 border-l-2 border-[rgba(63,143,92,.5)] pl-2 text-[12.5px] leading-snug text-uiFg2">{previews[s]}</p>
                        )}
                        {showRun && (status === 'failed' || status === 'skipped') && note && (
                          <p className={`line-clamp-2 text-2xs ${status === 'failed' ? 'text-danger' : 'text-warn'}`} title={note}>{note}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="flex min-h-0 flex-col gap-2.5 bg-uiSurface px-4 py-4">
                <p className="kicker">Model</p>
                <div role="radiogroup" aria-label="Model">
                  {MODEL_OPTIONS.map((m) => (
                    <label key={m.id} className={`flex h-[34px] cursor-pointer items-center gap-2.5 text-sm ${m.id === model ? 'font-semibold text-uiInk' : 'text-uiFg2'}`}>
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
                <dl className="flex flex-col gap-1.5 border-t border-uiCardRule pt-2.5 text-[13px] text-uiFg2">
                  <SummaryLine term="Sections" value={`${summary.on} of ${summary.of}`} />
                  {summary.off.length > 0 && <SummaryLine term="Off" value={summary.off.join(', ')} />}
                  <SummaryLine term="Model" value={modelOption(model).label} />
                  <SummaryLine term="Estimated cost" value={cost} />
                </dl>
                <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
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
                  className="btn btn-primary mt-auto h-[46px] w-full shrink-0 justify-center text-[15px]"
                >
                  {busy ? <CircleNotch size={15} className="animate-spin" /> : <Sparkle size={15} weight="fill" />}
                  {/* Switched-on sections only: tickedSections also holds the per-page review keys
                      ("about:subpages"), which the route does not run, so its length overstated the run
                      and, with no section on, enabled a button that would have written every section. */}
                  {busy ? 'Generating…' : generateLabel(summary.on, hasGenerated)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
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

/** A section's place in the run, in the approved words, beside its name while a run shows. */
function StatusTag({ status, on }: { status: SectionStatus | undefined; on: boolean }) {
  const label = statusLabel(status, on);
  const tone = !on ? 'text-uiFg3'
    : status === 'done' ? 'text-ok'
    : status === 'writing' ? 'text-uiAccent'
    : status === 'failed' ? 'text-danger'
    : status === 'skipped' ? 'text-warn'
    : 'text-uiFg3';
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 font-chromeMono text-[11px] ${tone}`}>
      {on && status === 'writing' && <CircleNotch size={12} className="animate-spin" />}
      {on && status === 'done' && <Check size={12} weight="bold" />}
      {on && status === 'failed' && <X size={12} weight="bold" />}
      {on && status === 'skipped' && <Warning size={12} weight="bold" />}
      {label}
    </span>
  );
}
