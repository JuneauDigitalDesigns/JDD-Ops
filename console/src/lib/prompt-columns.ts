/**
 * Column maths for the Prompt step's sideways prompt (PromptPlainView).
 *
 * The prompt flows into as many columns as fit the track's width at no less than MIN_WIDTH each,
 * so the visible columns always fill it exactly, and an arrow click moves by exactly one column:
 * the next one lines up with the left edge instead of stopping part-way through a line.
 */
export const MIN_WIDTH = 360;
export const GAP = 44;

export type ColumnLayout = { count: number; width: number; gap: number };

export function columnLayout(trackWidth: number): ColumnLayout {
  const w = Math.max(0, trackWidth);
  const count = Math.max(1, Math.floor((w + GAP) / (MIN_WIDTH + GAP)));
  const width = Math.max(1, (w - (count - 1) * GAP) / count);
  return { count, width, gap: GAP };
}

/** Where one arrow click lands: the next column boundary in that direction. A position already
 *  part-way through a column (after the wheel) goes to that column's own edge first. */
export function columnStep(scrollLeft: number, layout: ColumnLayout, dir: 1 | -1): number {
  const step = layout.width + layout.gap;
  const at = scrollLeft / step;
  const near = Math.round(at);
  const onEdge = Math.abs(at - near) < 0.02;
  const target = dir > 0
    ? (onEdge ? near + 1 : Math.ceil(at))
    : (onEdge ? near - 1 : Math.floor(at));
  return Math.max(0, target * step);
}
