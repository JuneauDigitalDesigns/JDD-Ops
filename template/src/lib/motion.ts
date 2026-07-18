// Shared framer-motion presets for the catalog. Micro-interaction scope only —
// reveals, staggers, hover lifts. No parallax / cursor / magnetic effects.
import type { Variants } from 'framer-motion';

export const EASE = [0.16, 1, 0.3, 1] as const;
export const viewportOnce = { once: true, amount: 0.3 } as const;

export const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export const revealItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export const revealStagger = (stagger = 0.06): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger } },
});

/** 'quiet' skin (or prefers-reduced-motion) renders still; others animate on view. */
export function stillFor(skin: 'editorial' | 'contrast' | 'quiet', reduce: boolean): boolean {
  return reduce || skin === 'quiet';
}
