/**
 * The exact set of SiteContent paths the copywriter prompt sends as "business facts" —
 * see compile.ts's `factsFor()`, moved here unchanged from the old buildCopyUserMessage's
 * inline `facts` object. Kept as a named, importable list (rather than only living inside
 * the object-literal that builds the facts JSON) so a future Facts block editor can render
 * exactly these rows and nothing else — no more, no less than what the model actually reads.
 *
 * Verified against the current buildCopyUserMessage rather than assumed: brand.short and
 * seo.canonical are NOT part of this list. `short` is never sent to the copywriter at all,
 * and `seo.canonical` is a field the copywriter is asked to WRITE (see the `seo` section
 * instruction), not a fact fed in.
 */
export const COPY_FACT_PATHS: string[] = [
  'brand.name',
  'brand.long',
  'brand.tagline',
  'brand.established',
  'brand.phone',
  'brand.email',
  'brand.address',
  'brand.license',
  'extensions.serviceArea',
  'extensions.hours.all',
  'extensions.trustBadges',
  'trust.logos',
];

/**
 * The key each fact path lands under in the compiled facts JSON — matches the old
 * buildCopyUserMessage's object literal exactly (`extensions.trustBadges` → `certifications`,
 * `trust.logos` → `notableClients`, etc.) so the shape the model has always seen doesn't
 * change just because the source moved from a hand-built object to this table.
 */
export const FACT_KEY_FOR_PATH: Record<string, string> = {
  'brand.name': 'name',
  'brand.long': 'long',
  'brand.tagline': 'tagline',
  'brand.established': 'established',
  'brand.phone': 'phone',
  'brand.email': 'email',
  'brand.address': 'address',
  'brand.license': 'license',
  'extensions.serviceArea': 'serviceArea',
  'extensions.hours.all': 'hours',
  'extensions.trustBadges': 'certifications',
  'trust.logos': 'notableClients',
};
