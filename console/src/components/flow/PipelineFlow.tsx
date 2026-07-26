'use client';
// The onboard.js pipeline — and, during a run, the live tracker.
//
// Layout is a column per site. That is not decoration: for starter/growth it's a single
// readable chain, and for enterprise it shows the actual fan-out (steps 2–9 loop once per
// site) which no list has ever made visible. Run-level phases — Intake, Pre-flight, Portal —
// sit centred above and below the columns because that is genuinely where they run.
//
// The phases come from run-plan.ts, either `restingPhases(ctx)` (derived from what's on disk)
// or `mergeRun(expectedPhases(ctx), run)` (live). Both produce the same shape, so the diagram
// does not know or care whether a run is in flight.

import { CheckCircle, Circle, CircleNotch, MinusCircle, WarningCircle, XCircle } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '@/lib/motion';
import type { PhaseStatus } from '@/lib/onboard-parse';
import type { PlannedPhase } from '@/lib/run-plan';
import type { ClientContext } from '@/lib/types';
import { styleFor, type FlowState } from './types';

const COL_W = 212;
const COL_GAP = 28;
const ROW_H = 46;
const ROW_GAP = 8;

const STATE_OF: Record<PhaseStatus, FlowState> = {
  pending: 'pending',
  running: 'running',
  done: 'done',
  failed: 'failed',
  skipped: 'skipped',
};

const GLYPH: Record<PhaseStatus, { Icon: typeof Circle; color: string; spin?: boolean }> = {
  pending: { Icon: Circle, color: 'var(--fg-3)' },
  running: { Icon: CircleNotch, color: 'var(--accent)', spin: true },
  done: { Icon: CheckCircle, color: 'var(--ok)' },
  failed: { Icon: XCircle, color: 'var(--danger)' },
  skipped: { Icon: MinusCircle, color: 'var(--fg-3)' },
};

function fmtMs(ms?: number) {
  if (ms == null) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

/** Split into the run-level head, the per-site columns, and the run-level tail. */
function partition(phases: PlannedPhase[]) {
  const head: PlannedPhase[] = [];
  const tail: PlannedPhase[] = [];
  const columns = new Map<string, PlannedPhase[]>();
  let seenSite = false;

  for (const p of phases) {
    if (p.siteSlug) {
      seenSite = true;
      const col = columns.get(p.siteSlug) ?? [];
      col.push(p);
      columns.set(p.siteSlug, col);
    } else if (seenSite) {
      tail.push(p);
    } else {
      head.push(p);
    }
  }
  return { head, tail, columns: [...columns.entries()] };
}

function PhaseRow({ p, delay, reduce }: { p: PlannedPhase; delay: number; reduce: boolean }) {
  const s = styleFor(STATE_OF[p.status]);
  const g = GLYPH[p.status];
  const ms = fmtMs(p.ms);

  return (
    <motion.div
      className="flex items-center gap-2.5 rounded-[10px] px-2.5"
      style={{
        height: ROW_H,
        opacity: s.opacity,
        background: p.unplanned ? 'var(--danger-glow)' : s.background,
        border: `1px ${s.dashed ? 'dashed' : 'solid'} ${p.unplanned ? 'var(--danger)' : s.border}`,
        boxShadow: p.status === 'running' ? '0 0 0 3px var(--accent-glow)' : undefined,
      }}
      initial={reduce ? false : { opacity: 0, x: -8 }}
      animate={reduce ? undefined : { opacity: s.opacity, x: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay }}
      title={p.detail}
    >
      <g.Icon
        size={15}
        weight={p.status === 'done' || p.status === 'failed' ? 'fill' : 'regular'}
        className={g.spin ? 'animate-spin' : undefined}
        style={{ color: g.color, flexShrink: 0 }}
      />
      <span className="min-w-0 flex-1 truncate text-xs font-medium" style={{ color: 'var(--fg-2)' }}>
        {p.label.split(' · ')[0]}
      </span>
      {p.unplanned && <WarningCircle size={13} weight="fill" style={{ color: 'var(--danger)', flexShrink: 0 }} />}
      {ms && <span className="kicker shrink-0" style={{ fontSize: 9 }}>{ms}</span>}
    </motion.div>
  );
}

export default function PipelineFlow({ phases, ctx }: { phases: PlannedPhase[]; ctx: ClientContext }) {
  const reduce = !!useReducedMotion();
  const { head, tail, columns } = partition(phases);

  const nCols = Math.max(1, columns.length);
  const canvasW = nCols * COL_W + (nCols - 1) * COL_GAP;
  const tallest = Math.max(0, ...columns.map(([, c]) => c.length));
  const step = ROW_H + ROW_GAP;

  // With one site there is no fan-out to show, so a single 212px column would just be a narrow
  // strip in a wide frame. Flow the whole run down-then-across instead and let it fill the
  // width. Multi-site keeps one column per site — that layout IS the fan-out.
  const single = columns.length <= 1;

  let i = 0;
  const stack = (list: PlannedPhase[]) =>
    list.map((p) => <PhaseRow key={p.key} p={p} delay={0.04 * i++} reduce={reduce} />);

  const siteName = (slug: string) => ctx.sites.find((s) => s.slug === slug)?.brandShort
    ?? ctx.sites.find((s) => s.slug === slug)?.brandName
    ?? slug;

  return (
    <figure className="diagram-figure">
      <figcaption className="flex flex-col gap-1.5 px-4 pt-4 pb-1">
        <span className="flex items-center gap-2.5">
          <span className="h-px w-8 shrink-0" style={{ background: 'var(--accent)' }} />
          <span className="kicker">What provisioning does</span>
        </span>
        <p className="max-w-[62ch] text-xs leading-[1.55] text-fg2">
          One command stands up the whole stack.
          {columns.length > 1
            ? ` Steps 2–9 run once per site — ${columns.length} columns, one per site.`
            : ' Greyed steps don’t run on this plan.'}
        </p>
      </figcaption>

      {/* overflow-x-auto WITHOUT no-scrollbar: a 3-site canvas can still exceed a narrow frame,
          and if it has to scroll it must say so. Hiding the scrollbar is what made the earlier
          clipping look like breakage rather than overflow. */}
      <div className="overflow-x-auto px-4 py-3">
        {single ? (
          // One multi-column flow: reads down, then across, and fills whatever width it gets.
          <div style={{ columns: `${COL_W}px`, columnGap: COL_GAP }}>
            {[...head, ...(columns[0]?.[1] ?? []), ...tail].map((p) => (
              <div key={p.key} style={{ breakInside: 'avoid', marginBottom: ROW_GAP }}>
                <PhaseRow p={p} delay={0.04 * i++} reduce={reduce} />
              </div>
            ))}
          </div>
        ) : (
        <div className="flex flex-col gap-2" style={{ minWidth: canvasW }}>
          {head.length > 0 && <div className="flex flex-col gap-2" style={{ width: COL_W }}>{stack(head)}</div>}

          {columns.length > 0 && (
            <div className="relative flex gap-7 pt-2">
              {/* The fan-out seam: a hairline that spans the columns it splits into. */}
              {columns.length > 1 && (
                <span
                  className="pointer-events-none absolute left-0 top-0 h-px"
                  style={{ width: canvasW, background: 'var(--rule-strong)' }}
                />
              )}
              {columns.map(([slug, col]) => (
                <div key={slug} className="flex flex-col gap-2" style={{ width: COL_W }}>
                  {columns.length > 1 && (
                    <span className="kicker truncate pb-0.5" style={{ color: 'var(--accent)' }}>
                      {siteName(slug)}
                    </span>
                  )}
                  {stack(col)}
                  {/* Pad shorter columns so the tail row still lines up under all of them. */}
                  {col.length < tallest && <span style={{ height: (tallest - col.length) * step }} />}
                </div>
              ))}
            </div>
          )}

          {tail.length > 0 && (
            <div className="flex flex-col gap-2 pt-2" style={{ width: COL_W }}>
              {columns.length > 1 && (
                <span className="h-px" style={{ width: canvasW, background: 'var(--rule-strong)' }} />
              )}
              {stack(tail)}
            </div>
          )}
        </div>
        )}
      </div>
    </figure>
  );
}
