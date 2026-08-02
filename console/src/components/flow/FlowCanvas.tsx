'use client';
// The wide renderer: hand-authored SVG for every edge, arrowhead and seam, with the nodes
// themselves as absolutely-positioned HTML on top.
//
// Why hybrid rather than pure <svg>: the nodes carry real provisioned values (a Twilio number,
// an agent id, a Make webhook URL) and those need to be selectable and copyable. <text> gives
// none of that — it would mean hand-rolled truncation and a click handler pretending to be a
// button. HTML nodes get .codechip styling, real wrapping, focus order, and the existing
// CopyButton for free. The edges are the part that genuinely wants vector geometry, and they
// stay vector.
//
// ⚠ The SVG layer MUST keep pointer-events-none. It covers the full canvas, so without it
// every click lands on the edge layer instead of the node underneath — including the copy
// buttons. It fails silently and looks like "the button just doesn't work".

import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import CopyButton from '../CopyButton';
import { EASE } from '@/lib/motion';
import { TONE_COLOR, styleFor, type EdgeSide, type FlowEdge, type FlowModel, type FlowNode } from './types';

/** First-paint guess, replaced by a real measurement before anything is visible. */
const DEFAULT_H = 76;
/** Breathing room below the lowest node when auto-growing the canvas. */
const BOTTOM_PAD = 8;

// Mirrors tailwind.config's `raised` / accent glow. Inline because these land on a style
// object computed per node, not a static class.
const RAISED = '0 1px 2px rgba(20,18,12,0.04), 0 4px 12px -4px rgba(20,18,12,0.10)';
const RUNNING_RING = '0 0 0 3px var(--accent-glow)';

/** Minimum clear space between two vertically-stacked nodes — enough for an edge label. */
const MIN_V_GAP = 34;

/**
 * Push rows down until no node overlaps the one below it.
 *
 * Authored `y` values assume a node height, and that assumption breaks exactly the way authored
 * WIDTHS did: values wrap, so a node's real height depends on the client's data and how wide its
 * column is. At 700px the /api/voice node grew to 213px and left a 9px gap above /api/voice/no-
 * answer — not enough to fit the "no answer" label, which then drew over the node.
 *
 * So vertical position is derived, not authored. Nodes sharing a `row` keep their relative
 * offsets and move as a unit (otherwise side-by-side nodes desync when only one column grows).
 * Rows only ever move down, so the composition is preserved.
 */
function relaxRows(nodes: FlowNode[], hOf: (n: FlowNode) => number): Record<string, number> {
  const rowIds = [...new Set(nodes.map((n) => n.row ?? 0))].sort((a, b) => a - b);
  const inRow = (r: number) => nodes.filter((n) => (n.row ?? 0) === r);
  const baseOf = (r: number) => Math.min(...inRow(r).map((n) => n.y));

  const rowTop: Record<number, number> = {};
  for (const r of rowIds) {
    let top = baseOf(r);
    for (const prev of rowIds.filter((x) => x < r)) {
      for (const p of inRow(prev)) {
        for (const n of inRow(r)) {
          const overlapX = n.x < p.x + p.w && p.x < n.x + n.w;
          if (!overlapX) continue;
          const pBottom = rowTop[prev] + (p.y - baseOf(prev)) + hOf(p) + MIN_V_GAP;
          top = Math.max(top, pBottom - (n.y - baseOf(r)));
        }
      }
    }
    rowTop[r] = top;
  }

  const y: Record<string, number> = {};
  for (const n of nodes) y[n.id] = rowTop[n.row ?? 0] + (n.y - baseOf(n.row ?? 0));
  return y;
}

function rectOf(n: FlowNode, measuredH?: number, y = n.y) {
  const h = measuredH ?? n.h ?? DEFAULT_H;
  return { x: n.x, y, w: n.w, h, cx: n.x + n.w / 2, cy: y + h / 2 };
}

function anchor(n: FlowNode, side: EdgeSide, measuredH?: number, y = n.y) {
  const r = rectOf(n, measuredH, y);
  switch (side) {
    case 'l': return { x: r.x, y: r.cy };
    case 'r': return { x: r.x + r.w, y: r.cy };
    case 't': return { x: r.cx, y: r.y };
    case 'b': return { x: r.cx, y: r.y + r.h };
  }
}

interface BuiltEdge {
  d: string;
  /** A point that lies ON the path, in clear space — not the anchors' midpoint. */
  label: { x: number; y: number; anchor: 'start' | 'middle' };
}

/**
 * A rounded elbow between two anchors, plus where its label belongs.
 *
 * Horizontal-first when leaving a side anchor, vertical-first when leaving top/bottom — so an
 * edge always exits its node perpendicular to the side it left from, which is what makes the
 * fork in the routing diagram readable.
 *
 * The label point is derived from the PATH, never from the anchors. Labels used to be drawn at
 * the straight-line midpoint between the two anchors, which for an elbow is not a point on the
 * path at all: "NO ANSWER" landed inside the node it pointed at and "ANSWERED" sat on top of a
 * node's status tag. Placing it on an actual straight run of the path keeps it in open space.
 */
function buildEdge(
  a: { x: number; y: number },
  b: { x: number; y: number },
  fromSide: EdgeSide,
  toSide: EdgeSide,
): BuiltEdge {
  const R = 12;
  const dy = b.y - a.y;
  const dx = b.x - a.x;

  // Pure horizontal.
  if (Math.abs(dy) < 1) {
    return {
      d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
      label: { x: (a.x + b.x) / 2, y: a.y - 9, anchor: 'middle' },
    };
  }

  // Pure vertical — same-column joins (voice→no-answer, owner→connected). Without this guard
  // the arc maths below goes degenerate when the two x values are equal.
  if (Math.abs(dx) < 1) {
    return {
      d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
      label: { x: a.x + 10, y: (a.y + b.y) / 2 + 3, anchor: 'start' },
    };
  }

  const vertical = fromSide === 't' || fromSide === 'b';
  const sweep = dy > 0 ? 1 : 0;

  if (vertical) {
    // Down/up out of the node, then across into the target's side.
    const midY = b.y;
    const dir = dx > 0 ? 1 : -1;
    return {
      d: [
        `M ${a.x} ${a.y}`,
        `L ${a.x} ${midY - R * (dy > 0 ? 1 : -1)}`,
        `A ${R} ${R} 0 0 ${dy > 0 ? (dir > 0 ? 0 : 1) : dir > 0 ? 1 : 0} ${a.x + R * dir} ${midY}`,
        `L ${b.x} ${b.y}`,
      ].join(' '),
      // On the vertical run, offset to the side it turns away from.
      label: { x: a.x + 10, y: a.y + (midY - a.y) / 2, anchor: 'start' },
    };
  }

  // Horizontal out, step vertically at the midpoint, horizontal in.
  const midX = a.x + dx / 2;
  const dirY = dy > 0 ? 1 : -1;
  return {
    d: [
      `M ${a.x} ${a.y}`,
      `L ${midX - R} ${a.y}`,
      `A ${R} ${R} 0 0 ${sweep} ${midX} ${a.y + R * dirY}`,
      `L ${midX} ${b.y - R * dirY}`,
      `A ${R} ${R} 0 0 ${sweep === 1 ? 0 : 1} ${midX + R} ${b.y}`,
      `L ${b.x} ${b.y}`,
    ].join(' '),
    // On the first horizontal run, anchored to its START rather than centred on it. Centring
    // let half the label extend back over the source node whenever the label was wider than
    // the run; starting 8px clear of the node's edge cannot.
    label: { x: a.x + 8, y: a.y - 9, anchor: 'start' },
  };
}

function edgeOpacity(e: FlowEdge): number {
  if (!e.state) return 1;
  return styleFor(e.state).opacity;
}

export default function FlowCanvas({
  model,
  className,
  scale = 1,
}: {
  model: FlowModel;
  className?: string;
  /** Fit factor from FlowFigure, which owns the measurement. 1 = authored size. */
  scale?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const byId = new Map(model.nodes.map((n) => [n.id, n]));

  // Nodes are HTML and size to their content, so their heights depend on the client's actual
  // values — a long Make webhook URL wraps where a short agent id doesn't. Authoring a fixed
  // `h` for each would be a guess that silently rots, and edges anchored to a guessed centre
  // land visibly off the node. So: measure after layout and re-anchor. Also lets the canvas
  // grow to fit rather than clipping its last row.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const els = useRef(new Map<string, HTMLElement>());

  const measure = useCallback(() => {
    const next: Record<string, number> = {};
    for (const [id, el] of els.current) next[id] = el.offsetHeight;
    setHeights((prev) => {
      const same = Object.keys(next).length === Object.keys(prev).length
        && Object.entries(next).every(([k, v]) => prev[k] === v);
      return same ? prev : next;
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    for (const el of els.current.values()) ro.observe(el);
    return () => ro.disconnect();
  }, [measure, model]);

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  }, []);

  const hOf = (n: FlowNode) => heights[n.id] ?? n.h ?? DEFAULT_H;
  const yOf = relaxRows(model.nodes, hOf);

  const height = Math.max(
    model.height,
    ...model.nodes.map((n) => yOf[n.id] + hOf(n) + BOTTOM_PAD),
  );

  return (
    // Outer box carries the SCALED footprint so the figure reserves the right amount of space;
    // the inner box keeps the authored coordinate system so node positions, measured heights
    // and edge anchors all stay in one unit. offsetHeight is layout-based and unaffected by an
    // ancestor transform, so the measurement above stays correct at any scale.
    <div className={className} style={{ width: model.width * scale, height: height * scale }}>
      <div
        style={{
          position: 'relative',
          width: model.width,
          height,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'left top',
        }}
      >
        {/* ── Edge layer ──────────────────────────────────────────────────── */}
        <svg
          viewBox={`0 0 ${model.width} ${height}`}
          width={model.width}
          height={height}
          className="pointer-events-none absolute inset-0"
          aria-hidden
        >
          <defs>
            {(['default', 'accent', 'ok', 'warn', 'danger'] as const).map((tone) => (
              <marker
                key={tone}
                id={`${uid}-arrow-${tone}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={TONE_COLOR[tone]} />
              </marker>
            ))}
          </defs>

          {model.edges.map((e, i) => {
            const from = byId.get(e.from);
            const to = byId.get(e.to);
            if (!from || !to) return null;
            const fromSide = e.fromSide ?? 'r';
            const toSide = e.toSide ?? 'l';
            const a = anchor(from, fromSide, heights[from.id], yOf[from.id]);
            const b = anchor(to, toSide, heights[to.id], yOf[to.id]);
            const tone = e.tone ?? 'default';
            const { d, label } = buildEdge(a, b, fromSide, toSide);
            const op = edgeOpacity(e);

            return (
              <g key={`${e.from}-${e.to}-${i}`} opacity={op}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={TONE_COLOR[tone]}
                  strokeWidth={1.5}
                  strokeDasharray={e.dashed ? '5 5' : undefined}
                  markerEnd={`url(#${uid}-arrow-${tone})`}
                  initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                  animate={reduce ? undefined : { pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.07 }}
                />
                {e.label && (
                  <text
                    x={label.x + (e.labelDx ?? 0)}
                    y={label.y + (e.labelDy ?? 0)}
                    textAnchor={label.anchor}
                    fill="var(--fg-3)"
                    style={{
                      fontFamily: 'var(--font-dm-mono), monospace',
                      // Kept narrow deliberately — these sit in the gutter between columns and
                      // must not grow wider than it. See gapFor()'s floor in layout.ts.
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* ── Node layer ──────────────────────────────────────────────────── */}
        {model.nodes.map((n, i) => (
          <FlowNodeBox key={n.id} node={n} y={yOf[n.id]} index={i} reduce={!!reduce} register={register} />
        ))}
      </div>
    </div>
  );
}

function FlowNodeBox({
  node: n, y, index, reduce, register,
}: {
  node: FlowNode;
  /** Relaxed vertical position — see relaxRows. Not the authored `n.y`. */
  y: number;
  index: number;
  reduce: boolean;
  register: (id: string, el: HTMLElement | null) => void;
}) {
  const s = styleFor(n.state, n.tone);
  const primary = n.emphasis !== 'secondary';
  const shown = n.value ?? n.placeholder;

  return (
    <motion.div
      ref={(el) => register(n.id, el)}
      className="absolute flex flex-col gap-1.5 rounded-[12px] px-3 py-2.5"
      style={{
        left: n.x,
        top: y,
        width: n.w,
        minHeight: n.h,
        opacity: s.opacity,
        background: s.background,
        border: `${primary ? 1.5 : 1}px ${s.dashed ? 'dashed' : 'solid'} ${s.border}`,
        boxShadow: n.state === 'running' ? RUNNING_RING : primary && !s.dashed ? RAISED : undefined,
      }}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={reduce ? undefined : { opacity: s.opacity, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: index * 0.05 }}
    >
      {n.kicker && (
        <span className="meta truncate" style={{ color: n.tone === 'default' ? 'var(--fg-3)' : TONE_COLOR[n.tone ?? 'default'] }}>
          {n.kicker}
        </span>
      )}

      <div className="flex items-start gap-1.5">
        {n.icon && <span className="mt-[1px] shrink-0">{n.icon}</span>}
        <span
          className={primary ? 'font-display text-base font-medium leading-[1.15]' : 'text-xs font-medium leading-[1.3] text-fg2'}
          style={{ letterSpacing: primary ? '-0.01em' : undefined }}
        >
          {n.title}
        </span>
      </div>

      {shown && (
        // No `truncate`: a half-shown agent id or webhook URL is useless for the thing these
        // nodes exist to do (verify a provisioned value at a glance). .codechip already sets
        // word-break: break-all, and node heights are measured at runtime so edges re-anchor
        // to whatever height the wrap produces.
        <div className="flex items-start gap-1.5">
          <code className="codechip min-w-0 flex-1" style={{ fontSize: 11.5, padding: '2px 6px' }} title={shown}>
            {shown}
          </code>
          {n.value && <CopyButton value={n.value} label="" />}
        </div>
      )}

      {n.note && <span className="text-[11px] leading-[1.4] text-fg3">{n.note}</span>}
      {s.tag && !n.value && <span className="meta">{s.tag}</span>}
    </motion.div>
  );
}
