import 'server-only';
import { readAudit } from './audit';
import { readState } from './state';

/**
 * When each client was last worked on, as an ISO timestamp keyed by base slug. This is the
 * client index's default sort — "what was I last doing" is a better answer to "who do I
 * want" than alphabetical, once there are more clients than fit on a screen.
 *
 * Two sources, because neither is complete on its own:
 *   • audit.ndjson records only /manage writes (see AuditAction — env, deploy, portal,
 *     agent, domain). A client you have only ever BUILT would look untouched forever.
 *   • progress.json's updatedAt covers runbook activity — status changes and step toggles —
 *     but nothing that happens in /manage.
 * Newest of the two wins.
 *
 * ISO-8601 strings sort correctly as strings, so nothing here parses a Date.
 *
 * Both readers resolve .state/ from process.cwd() (the console app dir), so this is two
 * small local file reads — cheap enough to do on every list request.
 */
export function lastTouchedBySlug(): Record<string, string> {
  const out: Record<string, string> = {};

  // readAudit() with no slug is the console-wide feed, newest first — but it is capped, so
  // don't assume the first hit per slug is the newest and compare anyway.
  for (const entry of readAudit({ limit: 2000 })) {
    const current = out[entry.slug];
    if (!current || entry.ts > current) out[entry.slug] = entry.ts;
  }

  for (const [slug, state] of Object.entries(readState())) {
    const updated = state.updatedAt;
    if (!updated) continue;
    const current = out[slug];
    if (!current || updated > current) out[slug] = updated;
  }

  return out;
}
