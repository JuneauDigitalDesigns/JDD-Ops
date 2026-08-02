// Status resolution and Kanban ordering maths.
//
// Deliberately pure — no React, no dnd-kit — so the rules a board enforces can be read and
// reasoned about on their own.
//
// This file used to also own the onboarding board's column rules (COLUMNS, buildColumns,
// canDrop, floorIndex, compareInColumn). That board was replaced by the leads funnel at /leads,
// and those five went with it — a lead has no disk-derived truth, so it has no floor and no
// refused drops. What survived is the half that still has consumers:
//
//   · effectiveStatus / columnFor — read by the client index's status sort and attention.ts
//   · the ordering maths          — reused verbatim by the leads board
//
// Client status is still settable, just not by dragging: StatusControl in the /c/{slug}/onboard
// step rail owns it now, which is where you'd actually know it changed.

import { STATUS_ORDER, type ClientState, type ClientStatus, type RunbookState } from './types';

/**
 * Which status a client should be shown as.
 *
 * `unknown` isn't a pipeline stage — it means the client folder is brand new or unreadable,
 * which is materially the same situation as "needs build".
 */
export function columnFor(status: ClientStatus): ClientStatus {
  return status === 'unknown' ? 'needs-build' : status;
}

/** The effective status: manual override when set, else what disk detection found. */
export function effectiveStatus(ctx: { slug: string; detectedStatus: ClientStatus }, state: RunbookState): ClientStatus {
  return state[ctx.slug]?.status ?? ctx.detectedStatus;
}

/** Whether a manual status has fallen behind what's actually on disk. */
export function isBehindDisk(ctx: { slug: string; detectedStatus: ClientStatus }, state: RunbookState): boolean {
  return STATUS_ORDER.indexOf(effectiveStatus(ctx, state)) < STATUS_ORDER.indexOf(ctx.detectedStatus);
}

/**
 * A sort key strictly between two neighbours.
 *
 * Fractional so a drop writes ONE record. Reindexing a whole column on every reorder would mean
 * N round-trips and a partially-applied order if one failed.
 */
export function orderBetween(prev: number | undefined, next: number | undefined): number {
  if (prev == null && next == null) return 0;
  if (prev == null) return next! - 1;
  if (next == null) return prev + 1;
  return (prev + next) / 2;
}

/**
 * Repeated midpoint splits between the same pair eventually exhaust float precision. It takes ~50
 * consecutive drops in the same gap, so this realistically never fires — but when the gap gets
 * this small the next split would silently collide, so the caller renormalises the column instead.
 */
export const MIN_ORDER_GAP = 1e-6;

export function needsRenormalise(prev: number | undefined, next: number | undefined): boolean {
  return prev != null && next != null && Math.abs(next - prev) < MIN_ORDER_GAP;
}

/**
 * The order value a card should take at `index` within `slugs` (the column's post-move list —
 * `index` is where the card now sits).
 *
 * The state parameter is widened past RunbookState so the leads board can reuse this as-is;
 * RunbookState satisfies it structurally, so no client-side call site changed.
 */
export function orderAt(
  slugs: string[],
  index: number,
  state: Record<string, { order?: number } | undefined>,
): { order: number; renormalise: boolean } {
  const orderOf = (s: string | undefined) => (s == null ? undefined : state[s]?.order);
  const prev = orderOf(slugs[index - 1]);
  const next = orderOf(slugs[index + 1]);
  return { order: orderBetween(prev, next), renormalise: needsRenormalise(prev, next) };
}

/** Whole-column reindex to 0,1,2,… — the escape hatch when fractional precision runs out. */
export function renormalise(slugs: string[]): { slug: string; order: number }[] {
  return slugs.map((slug, i) => ({ slug, order: i }));
}

export type { ClientState };
