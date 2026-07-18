import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

/**
 * Animates the numeric part of a label (e.g. "2,400+", "4.9", "24/7") from 0 to its
 * value once `run` is true. Preserves any prefix/suffix around the number. Honors
 * reduced motion (renders the final value immediately). Optional `delayMs` staggers
 * multiple instances.
 */
export function useCountUp(target: string | number | null | undefined, run: boolean, reduce: boolean, delayMs = 0): string {
  // Content values can be null/number (empty intake fields become null; JSON edits vary),
  // so coerce to a string before matching — never assume a string was passed.
  const safe = target == null ? '' : String(target);
  const [val, setVal] = useState(safe);

  useEffect(() => {
    if (!run || reduce) { setVal(safe); return; }
    const m = safe.match(/([^\d.]*)(\d+(?:\.\d+)?)([^\d.].*|$)/);
    if (!m) { setVal(safe); return; }
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
  }, [run, safe, reduce, delayMs]);

  return val;
}
