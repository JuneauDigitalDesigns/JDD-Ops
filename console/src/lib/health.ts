/**
 * The live-health shape returned by GET /api/manage/roster, keyed there by base slug.
 *
 * Lives in lib rather than beside the cell that renders it because the attention rules
 * (attention.ts) read the same shape, and a rules module importing a type out of a React
 * component is backwards — it also drags a 'use client' file into a server import graph.
 *
 * Deliberately a narrower view than the route's own return: the cell and the rules need the
 * deploy state, the probe and the URL. `inspectorUrl` and `urlSource` are the Manage
 * section's business, not this screen's.
 */
export interface ClientHealth {
  deploy: { state?: string; createdAt?: number } | null;
  http: { ok: boolean; status: number | null; ms: number } | null;
  liveUrl: string | null;
}
