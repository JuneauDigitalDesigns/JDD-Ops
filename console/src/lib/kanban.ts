// Column derivation and ordering maths for the roster Kanban.
//
// Deliberately pure — no React, no dnd-kit. The board's drag handling is fiddly enough that the
// rules it enforces (which column a client belongs in, which drops are legal, what sort key a
// dropped card gets) are worth keeping somewhere they can be read and reasoned about on their own.

import { STATUS_ORDER, type ClientContext, type ClientState, type ClientStatus, type RunbookState } from './types';

/** The five pipeline columns, in order. `unknown` is not one of them — see columnFor. */
export const COLUMNS: ClientStatus[] = STATUS_ORDER;

/**
 * Which column a client renders in.
 *
 * `unknown` isn't a pipeline stage — it means the client folder is brand new or unreadable, which
 * is materially the same situation as "needs build". Folding it there gives those clients a real
 * home you can drag them out of, instead of a sixth column that is empty ~always.
 */
export function columnFor(status: ClientStatus): ClientStatus {
  return status === 'unknown' ? 'needs-build' : status;
}

/**
 * The lowest column index a client may be dropped into.
 *
 * `detectedStatus` is derived from what's actually on disk, so it's a floor: a client whose repo
 * is provisioned cannot truthfully be "needs build". A detected `unknown` yields index 0 — we know
 * nothing, so nothing is blocked.
 */
export function floorIndex(ctx: ClientContext): number {
  const i = STATUS_ORDER.indexOf(ctx.detectedStatus);
  return i === -1 ? 0 : i;
}

/** Whether `ctx` may be dropped into `column`. Drops behind the disk-detected floor are refused. */
export function canDrop(ctx: ClientContext, column: ClientStatus): boolean {
  return STATUS_ORDER.indexOf(column) >= floorIndex(ctx);
}

/** The effective status: manual override when set, else what disk detection found. */
export function effectiveStatus(ctx: ClientContext, state: RunbookState): ClientStatus {
  return state[ctx.slug]?.status ?? ctx.detectedStatus;
}

/**
 * A sort key strictly between two neighbours.
 *
 * Fractional so a drop writes ONE client. patchClientState takes a single slug per call; reindexing
 * a whole column on every reorder would mean N round-trips and a partially-applied order if one
 * failed.
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

/** Sort key for a client within its column: dragged ones first by `order`, then untouched ones A→Z. */
function sortKey(ctx: ClientContext, state: RunbookState): [number, string] {
  const order = state[ctx.slug]?.order;
  return [order ?? Number.POSITIVE_INFINITY, ctx.brandName.toLowerCase()];
}

export function compareInColumn(a: ClientContext, b: ClientContext, state: RunbookState): number {
  const [ao, an] = sortKey(a, state);
  const [bo, bn] = sortKey(b, state);
  if (ao !== bo) return ao - bo;
  return an.localeCompare(bn);
}

/** Slugs per column, each already sorted. Every column is present, even when empty. */
export function buildColumns(
  clients: ClientContext[],
  state: RunbookState,
): Record<ClientStatus, string[]> {
  const out = {} as Record<ClientStatus, string[]>;
  for (const col of COLUMNS) out[col] = [];

  for (const ctx of clients) {
    const col = columnFor(effectiveStatus(ctx, state));
    // A status outside STATUS_ORDER would otherwise vanish from the board entirely.
    (out[col] ?? out['needs-build']).push(ctx.slug);
  }

  const byslug = new Map(clients.map((c) => [c.slug, c]));
  for (const col of COLUMNS) {
    out[col].sort((x, y) => compareInColumn(byslug.get(x)!, byslug.get(y)!, state));
  }
  return out;
}

/**
 * The order value a card should take at `index` within `slugs` (the column's post-move list,
 * excluding nothing — `index` is where the card now sits).
 */
export function orderAt(
  slugs: string[],
  index: number,
  state: RunbookState,
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
