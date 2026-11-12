import { isSampleList } from './presetIdentity';
/**
 * What a service's area picker stores (client-seo, 2026-11-10, same rule as the agency wizard).
 *
 * A service lists only its OWN towns, and its areas block shows only when it has some. "Every
 * town I cover" is therefore not a subset: stored as an empty list, so a service page never
 * repeats the full town list and the service-page gate's areas fact (which counts areas whenever
 * present) can't be had for free.
 */
export function serviceAreasToStore(picked: string[], siteArea: string[]): string[] {
  const site = new Set(siteArea.map((t) => t.trim().toLowerCase()).filter(Boolean));
  const chosen = new Set(picked.map((t) => t.trim().toLowerCase()).filter(Boolean));
  if (site.size > 0 && [...site].every((t) => chosen.has(t))) return [];
  return picked;
}

/**
 * The towns the Services step's "Towns this service covers" picker offers (Xander, 2026-11-12:
 * "fix the town picker so it never suggests sample towns"): the client's own service area, and
 * never a list a preset shipped as a sample. Judged as a whole list, exactly like
 * stripPresetIdentity (#88), so a client's own list keeps every town, Orlando included.
 */
export function townChoices(area: readonly string[] | null | undefined): string[] {
  if (!area?.length || isSampleList('extensions.serviceArea', area)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of area) {
    const t = typeof raw === 'string' ? raw.trim() : '';
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}
