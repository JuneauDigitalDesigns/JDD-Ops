import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

/**
 * Animates the numeric part of a label (e.g. "2,400+", "4.9", "24/7") from 0 to its
 * value once `run` is true. Preserves any prefix/suffix around the number. Honors
 * reduced motion (renders the final value immediately). Optional `delayMs` staggers
 * multiple instances.
 */
export function useCountUp(target: string, run: boolean, reduce: boolean, delayMs = 0): string {
  const [val, setVal] = useState(target);

  useEffect(() => {
    if (!run || reduce) { setVal(target); return; }
    const m = target.match(/([^\d.]*)(\d+(?:\.\d+)?)([^\d.].*|$)/);
    if (!m) { setVal(target); return; }
    const [, pre, numStr, post] = m;
    const end = parseFloat(numStr);

    let controls: ReturnType<typeof animate> | undefined;
    const timer = setTimeout(() => {
      controls = animate(0, end, {
        duration: 1.2,
        ease: [0.16, 1, 0.3, 1],
        onUpdate(v: number) {
          const fmt = end >= 100 ? Math.round(v).toString() : v.toFixed(numStr.includes('.') ? 1 : 0);
          setVal(`${pre}${fmt}${post}`);
        },
      });
    }, delayMs);

    return () => { clearTimeout(timer); controls?.stop(); };
  }, [run, target, reduce, delayMs]);

  return val;
}
