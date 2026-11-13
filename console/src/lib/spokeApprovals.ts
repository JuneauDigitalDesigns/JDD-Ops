import { canonicalTown, townSlugs } from '@jdd/schema';

/**
 * Phase 3: which spoke routes a composition carries without an approval behind them. Pure and
 * client-safe. The export refuses those (a spoke is only ever built on demand Xander approved in
 * Search), because its SEO score checks a spoke with qualifiesForSpokePage(..., true) and so
 * trusts that the approval exists.
 *
 * An approval is `{ town, service }`: the town in any case, matched through canonicalTown; the
 * service as its slug. A spoke's route is `areas/<town slug>/<service slug>`.
 */
export interface ApprovedSpoke {
  town: string;
  service: string;
}

type Json = Record<string, unknown>;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});

export function unapprovedSpokeRoutes(
  pages: Array<{ route: string; pageType: string }>,
  content: unknown,
  approved: ApprovedSpoke[],
): string[] {
  const area = arr(obj(obj(content).extensions).serviceArea).map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  const slugs = townSlugs(content);
  const ok = new Set<string>();
  for (const a of approved) {
    const i = area.indexOf(canonicalTown(content, a.town));
    if (i >= 0) ok.add(`areas/${slugs[i]}/${a.service}`);
  }
  return pages.filter((p) => p.pageType === 'spoke' && !ok.has(p.route)).map((p) => p.route);
}
