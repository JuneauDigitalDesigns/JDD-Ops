'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleNotch, Check, X, Warning, Sparkle } from '@phosphor-icons/react';
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { ALL_SECTIONS, type Section } from '@/lib/copy-schema';
import { labelFor } from '@/lib/section-labels';
import { setTickedSections } from '@/lib/copy-brief/mutations';
import { MODEL_OPTIONS, DEFAULT_MODEL_ID } from '@/lib/model-pricing';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

type SectionStatus = 'idle' | 'writing' | 'done' | 'failed';
type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

/** Long generation runs are still just a few LLM calls, not an npm build — 90s idle is
 *  already generous, reused from DeployDialog's own watchdog constant for consistency. */
const IDLE_TIMEOUT_MS = 90_000;

export default function RunControls({
  vertical, base, imported, brief, tickedSections, onBriefChange, model, onModelChange,
  onGenerated, onClearGenerated, hasGenerated,
}: {
  vertical: string;
  base: SiteContent;
  imported: SiteContent | null;
  brief: CopyBrief;
  tickedSections: Section[];
  onBriefChange: Update;
  model: string;
  onModelChange: (m: string) => void;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  hasGenerated: boolean;
}) {
  const sectionOptions = ALL_SECTIONS.filter((s) => s !== 'brand');
  const [statuses, setStatuses] = useState<Record<string, SectionStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [run, setRun] = useState<RunState>({ kind: 'idle' });
  const [estimate, setEstimate] = useState<{ estInputTokens: number; estOutputTokens: number; estCostUsd: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ticked = new Set(tickedSections);
  const toggle = (s: Section) =>
    onBriefChange((b) => setTickedSections(b, ticked.has(s) ? tickedSections.filter((x) => x !== s) : [...tickedSections, s]));
  const allTicked = sectionOptions.every((s) => ticked.has(s));

  // Debounced token/cost estimate whenever the run inputs change.
  useEffect(() => {
    if (tickedSections.length === 0) { setEstimate(null); return; }
    if (estimateTimer.current) clearTimeout(estimateTimer.current);
    estimateTimer.current = setTimeout(() => {
      setEstimating(true);
      fetch('/api/build/estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vertical, base, imported, brief, sections: tickedSections, model }),
      })
        .then((r) => r.json())
        .then((data) => setEstimate(data.error ? null : data))
        .catch(() => setEstimate(null))
        .finally(() => setEstimating(false));
    }, 500);
    return () => { if (estimateTimer.current) clearTimeout(estimateTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- base/imported/brief are large objects; re-running on every keystroke elsewhere is the point, JSON.stringify above is what actually changes.
  }, [vertical, base, imported, brief, tickedSections, model]);

  async function generate() {
    setRun({ kind: 'running' });
    setErrors({});
    const initial: Record<string, SectionStatus> = {};
    for (const s of tickedSections) initial[s] = 'idle';
    setStatuses(initial);

    let res: Response;
    try {
      res = await fetch('/api/build/generate-copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vertical, base, imported, brief, sections: tickedSections, model }),
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
            setStatuses((prev) => ({ ...prev, [section]: msg.status as SectionStatus }));
            if (msg.status === 'failed' && msg.error) {
              setErrors((prev) => ({ ...prev, [section]: String(msg.error) }));
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

    if (timedOut) {
      setRun({ kind: 'error', message: 'The copy service stopped responding.' });
    } else if (sawDone) {
      setRun({ kind: 'done' });
    } else {
      setRun((prev) => (prev.kind === 'error' ? prev : { kind: 'error', message: 'The connection ended before generation finished.' }));
    }
  }

  const busy = run.kind === 'running';

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto border-l border-uiCardRule p-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="kicker">Sections to write</p>
          <button
            type="button"
            onClick={() => onBriefChange((b) => setTickedSections(b, allTicked ? [] : sectionOptions))}
            disabled={busy}
            className="mono text-2xs text-uiInkSoft hover:text-uiInk"
          >
            {allTicked ? 'None' : 'All'}
          </button>
        </div>
        <div className="overflow-hidden rounded-lg border border-uiCardRule">
          {sectionOptions.map((s, i) => {
            const status = statuses[s] ?? 'idle';
            return (
              <div key={s} className={`flex items-center gap-2 px-3 py-1.5 ${i > 0 ? 'border-t border-uiCardRule' : ''}`}>
                <input
                  type="checkbox"
                  checked={ticked.has(s)}
                  onChange={() => toggle(s)}
                  disabled={busy}
                  className="shrink-0 cursor-pointer"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-uiFg2">{labelFor(s)}</span>
                <StatusIcon status={status} />
              </div>
            );
          })}
        </div>
        {run.kind !== 'idle' && Object.keys(errors).length > 0 && (
          <div className="mt-2 space-y-1">
            {Object.entries(errors).map(([s, msg]) => (
              <p key={s} className="text-2xs text-danger">{labelFor(s as Section)}: {msg}</p>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="kicker mb-2">Model</p>
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={busy}
          className="w-full rounded-md border border-uiCardRule bg-uiBg px-2 py-1.5 text-sm text-uiFg2 outline-none focus:border-uiAccent"
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="kicker mb-2">Estimated cost</p>
        {estimating ? (
          <p className="mono text-xs text-uiInkSoft">estimating…</p>
        ) : estimate ? (
          <p className="mono text-xs text-uiFg2">
            ~{estimate.estInputTokens.toLocaleString()} in / ~{estimate.estOutputTokens.toLocaleString()} out · ~${estimate.estCostUsd.toFixed(2)}
          </p>
        ) : (
          <p className="mono text-xs text-uiInkSoft">tick a section to estimate</p>
        )}
        <p className="mt-1 text-2xs text-uiInkSoft">Input is exact; output is a working guess until a run reports real usage.</p>
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={busy || tickedSections.length === 0}
        className="btn btn-primary mt-auto w-full justify-center"
      >
        {busy ? <CircleNotch size={15} className="animate-spin" /> : <Sparkle size={15} weight="fill" />}
        {busy ? 'Generating…' : `${hasGenerated ? 'Regenerate' : 'Generate'} ${tickedSections.length} section${tickedSections.length === 1 ? '' : 's'}`}
      </button>

      {run.kind === 'done' && (
        <p className="flex items-center gap-1.5 text-sm text-ok">
          <Check size={15} weight="bold" /> Copy applied — review it on the next stage.
        </p>
      )}
      {run.kind === 'error' && (
        <p className="flex items-center gap-1.5 text-sm text-danger">
          <Warning size={15} /> {run.message}
        </p>
      )}
      {hasGenerated && !busy && (
        <button type="button" onClick={onClearGenerated} className="mono text-2xs text-uiInkSoft hover:text-uiInk">
          Revert generated copy
        </button>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: SectionStatus }) {
  if (status === 'writing') return <CircleNotch size={13} className="shrink-0 animate-spin text-uiInkSoft" />;
  if (status === 'done') return <Check size={13} weight="bold" className="shrink-0 text-ok" />;
  if (status === 'failed') return <X size={13} weight="bold" className="shrink-0 text-danger" />;
  return null;
}
