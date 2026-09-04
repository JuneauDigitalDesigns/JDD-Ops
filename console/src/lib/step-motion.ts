/**
 * The slide+fade transition used for both the outer wizard steps (Intake → Studio,
 * BuildWizard.tsx) and the Intake step's own three sub-stages (Brief → Prompt → Review,
 * IntakeStep.tsx). Extracted so there's one definition instead of two hand-written copies
 * that could drift apart in duration or easing.
 */
import type { Variants } from 'framer-motion';
import { EASE } from '@/lib/motion';

export function stepVariants(reduce: boolean | null): Variants {
  return {
    enter: (d: number) => ({ x: reduce ? 0 : d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: reduce ? 0 : d > 0 ? '-100%' : '100%', opacity: 0 }),
  };
}

export const STEP_TRANSITION_DURATION = 0.42;

export function stepTransition(reduce: boolean | null) {
  return { duration: reduce ? 0 : STEP_TRANSITION_DURATION, ease: EASE };
}
