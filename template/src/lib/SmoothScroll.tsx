'use client';
// ─────────────────────────────────────────────────────────────────────────────
// SmoothScroll — the global smoothed-scroll surface (decisions 25 + 54). Ships
// Lenis, ~10KB gzipped, behind four mandatory guards. Renders nothing.
//
// All four guards are load-bearing and none is optional (see the plan §Phase 6):
//   1. dynamic `import('lenis')` so it is never in the first-paint bundle;
//   2. `ssr: false` on the `next/dynamic` import in layout.tsx (same reason);
//   3. a prefers-reduced-motion early return that NEVER constructs Lenis;
//   4. a `window.self !== window.top` iframe check: the console preview runs this
//      inside PreviewFrame's iframe, where a scroll hijack fights the studio's own
//      scroll container, and §0.4 freezes animation there anyway.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';

export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.self !== window.top) return;

    let instance: { raf: (time: number) => void; destroy: () => void } | null = null;
    let frame = 0;
    let cancelled = false;

    void import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      instance = new Lenis({
        duration: 1.05,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
      const loop = (time: number) => {
        instance?.raf(time);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      instance?.destroy();
    };
  }, []);

  return null;
}
