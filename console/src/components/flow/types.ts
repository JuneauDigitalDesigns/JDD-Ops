// The node/edge model behind every runbook diagram.
//
// One model, three renderers: FlowCanvas (wide, SVG edges + HTML nodes), FlowStack (narrow,
// vertical list), and — for the pipeline — the same data reused as a live run tracker. The
// diagram components below build this model from ClientContext; nothing here knows about
// clients, env vars, or onboard.js.
//
// Coordinates are PIXELS in a fixed canvas, not a scaled viewBox. FlowFigure scrolls the
// canvas horizontally when the stage is too narrow, so a node is always drawn at its
// authored size and label text never shrinks below legibility.

export type FlowState =
  | 'live' // real, provisioned, value known
  | 'pending' // will exist after provisioning; value not known yet
  | 'skipped' // will never exist on this plan
  | 'running' // currently being provisioned
  | 'done' // provisioned during this run
  | 'failed'; // provisioning failed here

export type FlowTone = 'default' | 'accent' | 'ok' | 'warn' | 'danger';

export interface FlowNode {
  id: string;
  x: number;
  /**
   * Authored vertical position — a starting composition, not the final one. Nodes in the same
   * `row` move together, and FlowCanvas pushes rows down when a measured node grows into the
   * row below (values wrap, so heights depend on the client's data and the canvas width).
   */
  y: number;
  /**
   * Horizontal band this node belongs to. Nodes sharing a row keep their relative y offsets and
   * are relaxed as a unit, so side-by-side nodes never desync when one column grows taller.
   */
  row?: number;
  w: number;
  /** Omit to let the node size to its content; set only when edges must anchor precisely. */
  h?: number;
  /** Uppercase mono label above the title — usually the env var name that backs this node. */
  kicker?: string;
  title: string;
  /** A real bound value (phone number, agent id, URL). Renders as a copyable code chip. */
  value?: string;
  /** Shown instead of `value` when the value isn't known yet. */
  placeholder?: string;
  note?: string;
  state: FlowState;
  tone?: FlowTone;
  /**
   * 'primary' is the default/happy path and reads heavier; 'secondary' is a fallback branch.
   * The call-routing diagram exists to make this distinction visible.
   */
  emphasis?: 'primary' | 'secondary';
  /** Phosphor glyph, already sized by the caller. */
  icon?: React.ReactNode;
}

export type EdgeSide = 'l' | 'r' | 't' | 'b';

export interface FlowEdge {
  from: string;
  to: string;
  /** Anchor sides. Defaults to right→left (a left-to-right flow). */
  fromSide?: EdgeSide;
  toSide?: EdgeSide;
  label?: string;
  /**
   * Nudges for the label, in canvas px. The default position is derived from the path itself
   * (see buildEdge), so these exist only for the occasional crowded corner — a one-line fix
   * instead of another geometry refactor.
   */
  labelDx?: number;
  labelDy?: number;
  tone?: FlowTone;
  dashed?: boolean;
  /** Dim the edge the same way a skipped/pending node is dimmed. */
  state?: FlowState;
}

export interface FlowModel {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Canvas size in px. Height should clear the lowest node + its label. */
  width: number;
  height: number;
}

// ── Shared visual resolution ────────────────────────────────────────────────
// Every renderer resolves state → colour/opacity/border through these two functions so the
// canvas and the stacked fallback can't drift apart.

export const TONE_COLOR: Record<FlowTone, string> = {
  default: 'var(--rule-strong)',
  accent: 'var(--accent)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

export interface StateStyle {
  opacity: number;
  dashed: boolean;
  border: string;
  background: string;
  /** Extra label rendered in the node's corner, e.g. "not on Starter". */
  tag?: string;
}

export function styleFor(state: FlowState, tone: FlowTone = 'default'): StateStyle {
  switch (state) {
    case 'live':
    case 'done':
      return { opacity: 1, dashed: false, border: TONE_COLOR[tone], background: 'var(--panel)' };
    case 'running':
      return { opacity: 1, dashed: false, border: 'var(--accent)', background: 'var(--panel)' };
    case 'failed':
      return { opacity: 1, dashed: false, border: 'var(--danger)', background: 'var(--danger-glow)' };
    case 'skipped':
      return { opacity: 0.4, dashed: true, border: 'var(--rule)', background: 'transparent', tag: 'not on this plan' };
    case 'pending':
    default:
      return { opacity: 0.55, dashed: true, border: 'var(--rule)', background: 'transparent', tag: 'provision first' };
  }
}
