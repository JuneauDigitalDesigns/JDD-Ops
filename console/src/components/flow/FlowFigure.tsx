'use client';
// The frame every diagram sits in: eyebrow + caption + the canvas, on a raised surface.
//
// SIZING — this is where the diagrams got clipped once, so the rule is explicit:
//
// Never assume a container width. An earlier version of this comment asserted "at 1280px the
// stage is ~940px, which clears the canvases below" — that number was guessed, the stage was
// actually capped at 860px, and both 860px-wide canvases lost ~128px off their right edge.
// Worse, the wrapper carried `no-scrollbar` on `overflow-x-auto`, so the overflow was
// unreachable AND invisible: it just looked broken.
//
// A later attempt fixed the clipping by scaling the fixed canvas down to fit — which then left
// a quarter of the frame empty on a wide window, because a fixed canvas can only ever be the
// wrong size in one direction or the other.
//
// So the diagrams are FLUID. The width is measured, the model is built from that width (columns
// are relative shares — see layout.ts), and the canvas always equals its frame exactly:
//   >= MIN_CANVAS  → FlowCanvas, built to the measured width
//   <  MIN_CANVAS  → FlowStack (the same model, vertical)
//
// No scaling, no dead space, no sideways scrolling, nothing hidden off-edge. The measurement is
// of the real content box, so it accounts for the rail and the stage padding — which a viewport
// breakpoint (the old `md:block` / `md:hidden`) could not.

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import FlowCanvas from './FlowCanvas';
import FlowStack from './FlowStack';
import type { FlowModel } from './types';

/**
 * Narrower than this, four columns can't hold a code chip no matter how the width is divided,
 * so the vertical stack communicates better than a squeezed canvas.
 */
const MIN_CANVAS = 620;

/** Width used for the first paint, before the real measurement lands. */
const SSR_WIDTH = 1000;

export default function FlowFigure({
  build,
  eyebrow,
  caption,
  footer,
}: {
  /**
   * Builds the model for a given canvas width. The diagram is fluid: columns are shares of the
   * width the figure actually measured, so it fills its frame at any size instead of being
   * authored against a guessed number (which has now been wrong twice).
   */
  build: (width: number) => FlowModel;
  eyebrow?: string;
  caption?: string;
  footer?: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  // null = not yet measured. Render at 1:1 on that first pass so SSR and the first client
  // paint agree; useLayoutEffect corrects before the browser paints, so there's no flash.
  const [avail, setAvail] = useState<number | null>(null);

  const measure = useCallback(() => {
    const el = wrap.current;
    if (el) setAvail(el.clientWidth);
  }, []);

  useLayoutEffect(() => {
    measure();
    // ResizeObserver alone proved unreliable for viewport-driven resizes here, and a stale
    // scale means a clipped diagram — the exact bug this file exists to prevent. The window
    // listener is the cheap belt to the observer's braces.
    window.addEventListener('resize', measure);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && wrap.current) {
      ro = new ResizeObserver(measure);
      ro.observe(wrap.current);
    }
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [measure]);

  // Fluid: the canvas IS the available width, so there is nothing to scale and no dead space.
  const width = avail ?? SSR_WIDTH;
  const useStack = avail != null && avail < MIN_CANVAS;
  const model = build(Math.max(width, MIN_CANVAS));

  return (
    <figure className="diagram-figure">
      {(eyebrow || caption) && (
        <figcaption className="flex flex-col gap-1.5 px-4 pt-4 pb-1">
          {eyebrow && (
            <span className="flex items-center gap-2.5">
              <span className="h-px w-8 shrink-0" style={{ background: 'var(--accent)' }} />
              <span className="kicker">{eyebrow}</span>
            </span>
          )}
          {caption && <p className="max-w-[62ch] text-xs leading-[1.55] text-fg2">{caption}</p>}
        </figcaption>
      )}

      {/* Padding lives on the OUTER div and the ref on the inner one, because clientWidth
          includes padding — measuring the padded element reported 32px more room than exists
          and the canvas overflowed its own gutter by exactly that much. The measured element
          must have no padding of its own.

          No overflow-x here by design: scale-to-fit means the canvas cannot exceed the box,
          so there is nothing to scroll and nothing to hide. */}
      <div className="px-4 py-3">
        <div ref={wrap}>
          {useStack ? <FlowStack model={model} /> : <FlowCanvas model={model} />}
        </div>
      </div>

      {footer && <div className="border-t border-rule px-4 py-2.5">{footer}</div>}
    </figure>
  );
}
