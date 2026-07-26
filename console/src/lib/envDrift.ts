import type { DriftState } from './useEnvEditor';

/**
 * How a disk-vs-Vercel comparison reads in the UI. Shared so the field chip, the diff
 * panel, and the roster column all describe the same state the same way.
 *
 * 'unknown' is not a problem: it means the key exists on Vercel but we deliberately
 * didn't spend a request decrypting it (master credentials). Colouring it like a mismatch
 * would cry wolf on every client.
 */
export const DRIFT_LABEL: Record<DriftState, string> = {
  'in-sync': 'in sync',
  differs: 'differs on Vercel',
  'missing-remote': 'not on Vercel',
  'remote-only': 'only on Vercel',
  unknown: 'set on Vercel',
};

/** Short form for tight columns. */
export const DRIFT_SHORT: Record<DriftState, string> = {
  'in-sync': 'synced',
  differs: 'differs',
  'missing-remote': 'missing',
  'remote-only': 'remote',
  unknown: 'set',
};

export function driftColor(state: DriftState): string {
  if (state === 'in-sync') return 'var(--ok)';
  if (state === 'differs' || state === 'missing-remote') return 'var(--danger)';
  return 'var(--fg-3)';
}

/**
 * Only these two are actionable — the others are informational. A type guard so callers
 * can render the diff panel without re-narrowing the nullable state.
 */
export function isDrifted(
  state: DriftState | null | undefined,
): state is 'differs' | 'missing-remote' {
  return state === 'differs' || state === 'missing-remote';
}
