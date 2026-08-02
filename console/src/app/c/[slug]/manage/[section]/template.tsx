'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '@/lib/motion';

/**
 * Entrance animation for a section swap.
 *
 * A template (not a layout) because App Router re-instantiates templates on every
 * navigation — which is exactly the keyed enter-only animation StepStage settled on.
 * No AnimatePresence and no exit animation: StepStage documents that `mode="wait"`
 * stalls navigation, and that reasoning applies here too.
 *
 * Opacity starts at 0.55, never 0. The browser preview pane runs with
 * visibilityState=hidden, which throttles rAF — a stalled 0 → 1 would leave the whole
 * section invisible and read as a broken route. From 0.55 a frozen frame is still legible.
 */
export default function SectionTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0.55, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.28, ease: EASE }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
