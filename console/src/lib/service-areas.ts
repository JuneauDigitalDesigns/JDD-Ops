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
