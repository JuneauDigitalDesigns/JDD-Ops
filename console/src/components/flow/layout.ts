// Column maths for the fluid diagrams.
//
// The diagrams were authored at fixed pixel widths twice, and both times the number was wrong
// for the box they ended up in — first clipped, then leaving a quarter of the frame empty. The
// fix is to stop authoring widths at all: a diagram declares the RELATIVE weight of each column
// and this file turns that into pixels using the width the figure actually measured.

/** One resolved column: absolute x and width in canvas px. */
export interface Column {
  x: number;
  w: number;
}

/**
 * Gap between columns, scaled gently with the canvas so a narrow diagram doesn't waste half its
 * width on whitespace and a wide one doesn't look like disconnected islands.
 *
 * The 56px floor is not arbitrary: edge labels ("passed", "no answer") are drawn in the gutter,
 * and at a 48px gutter "PASSED" ran ~10px into the node it pointed at. The gutter must stay
 * wide enough to hold the widest label the diagrams use.
 */
export function gapFor(width: number): number {
  return Math.round(Math.min(72, Math.max(56, width * 0.055)));
}

/**
 * Distribute columns across `width`, with equal gaps between them.
 *
 * `weights` are relative shares of the leftover width — a column with weight 1.4 gets 1.4× the
 * width of one with weight 1.0. The last column's right edge lands exactly on `width`, so the
 * canvas is always completely filled and never overflows.
 */
export function columns(width: number, weights: number[], gap = gapFor(width)): Column[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const budget = width - gap * (weights.length - 1);
  const out: Column[] = [];
  let x = 0;

  weights.forEach((weight, i) => {
    // Pin the final column to the right edge so accumulated rounding can't leave a 1-2px gap
    // or, worse, push the last node past the canvas.
    const w = i === weights.length - 1 ? width - x : Math.round((weight / total) * budget);
    out.push({ x, w });
    x += w + gap;
  });

  return out;
}
