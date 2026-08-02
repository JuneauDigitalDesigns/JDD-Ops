import { effectiveStatus, isBehindDisk } from './kanban';
import type { ClientContext, RunbookState } from './types';
import type { ClientHealth } from './health';

/**
 * What "needs attention" means on the client index.
 *
 * Deliberately pure — no React, no fetching — the same way kanban.ts keeps its column rules
 * somewhere they can be read on their own.
 *
 * Two design constraints worth stating, because both are easy to undo by accident:
 *
 * 1. CHEAP SIGNALS ONLY. Everything here comes from /api/manage/roster (deploy state + HTTP
 *    probe) or from state already in memory. Env drift is NOT here on purpose: CLAUDE.md
 *    documents it as one Vercel request per key per site, which on a 15–50 client roster is
 *    hundreds of calls to paint a screen you open constantly. Drift stays an explicit button.
 *
 * 2. PROBLEMS ONLY. The old board also flagged "ready to provision" (ClientBoard's attention
 *    strip). At this roster size that fires on a large fraction of clients permanently, and a
 *    warning that is always on is wallpaper. "Ready" is a next action, and belongs on the row
 *    itself — not in a band that is supposed to mean something is wrong.
 */

export type AttentionKind = 'down' | 'deploy-failed' | 'behind-disk' | 'stalled';

export interface AttentionItem {
  slug: string;
  brandName: string;
  kind: AttentionKind;
  /** One line, already written for display. */
  reason: string;
  /** 0 = most urgent. The index sorts the strip and the rows on this. */
  rank: number;
}

/** A client not yet live and untouched for this long is stalled. */
const STALL_DAYS = 14;
const STALL_MS = STALL_DAYS * 24 * 60 * 60 * 1000;

/**
 * The single most urgent thing wrong with one client, or null if nothing is.
 *
 * Returns the FIRST matching rule rather than all of them: one client contributes at most one
 * row to the strip, so a client that is both down and stalled reads as "down" — which is the
 * one you would act on.
 */
export function attentionFor(
  ctx: ClientContext,
  state: RunbookState,
  health: ClientHealth | undefined,
  lastTouched: string | undefined,
): AttentionItem | null {
  const base = { slug: ctx.slug, brandName: ctx.brandName };

  // 0 — the site is answering, and answering badly. `http` is null when there was no URL to
  // probe, which is not the same as a failure, so test ok explicitly.
  if (health?.http && health.http.ok === false) {
    const status = health.http.status;
    return { ...base, kind: 'down', rank: 0, reason: `Site down (${status ?? 'unreachable'})` };
  }

  // 1 — the last thing Vercel tried to ship didn't build.
  if (health?.deploy?.state === 'ERROR') {
    return { ...base, kind: 'deploy-failed', rank: 1, reason: 'Last deploy failed' };
  }

  // 2 — a provisioning run advanced what's on disk past the manual status. Only a run can
  // create this now; the status control in the onboard step rail is the sole manual writer.
  const effective = effectiveStatus(ctx, state);
  if (isBehindDisk(ctx, state)) {
    return { ...base, kind: 'behind-disk', rank: 2, reason: 'Status is behind what’s on disk' };
  }

  // 3 — mid-onboarding and nobody has touched it in a fortnight. Live clients are excluded:
  // a live client SHOULD sit untouched, that's what success looks like.
  if (effective !== 'live' && lastTouched) {
    const age = Date.now() - Date.parse(lastTouched);
    if (Number.isFinite(age) && age > STALL_MS) {
      const days = Math.floor(age / (24 * 60 * 60 * 1000));
      return { ...base, kind: 'stalled', rank: 3, reason: `Onboarding stalled — ${days} days` };
    }
  }

  return null;
}

/** Every client with something wrong, most urgent first. */
export function collectAttention(
  clients: ClientContext[],
  state: RunbookState,
  health: Record<string, ClientHealth>,
  lastTouched: Record<string, string>,
): AttentionItem[] {
  return clients
    .map((c) => attentionFor(c, state, health[c.slug], lastTouched[c.slug]))
    .filter((x): x is AttentionItem => x !== null)
    .sort((a, b) => a.rank - b.rank || a.brandName.localeCompare(b.brandName));
}
