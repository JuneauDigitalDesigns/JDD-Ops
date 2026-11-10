/**
 * Copy that would ship without the client's facts behind it (SEO plan D2, Xander 2026-11-10).
 *
 * Two kinds:
 *   presetCopy        a visible field still equal to the vertical preset's sample text, which ships
 *                     whenever the copywriter skips a field
 *   unsupportedClaims a claim ("same day", "licensed", "24/7", "guarantee", ...) in visible copy that
 *                     nothing in the client's facts says
 *
 * Xander's call: NOT a go-live block. "Warn loudly at the end of the intake wizard before we move
 * onto the build wizard." So this only reports; intake-wizard's final step renders it, the Studio
 * may list it, and the export never refuses on it alone. The hard export checks (dashes, numbers
 * that aren't in the facts, duplicate titles, wrong canonical) are scorePage's, and exempt preset
 * text for exactly this reason.
 *
 * Reads content structurally, so it works on the full SiteContent and on the intake's partial one.
 */

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});

/** Top-level keys that hold visible marketing copy. brand, nav, images, extensions, _meta, seo
 *  canonical/ids and overrides are facts, links or settings, never claims. */
const COPY_ROOTS = ['announcement', 'trust', 'hero', 'about', 'services', 'work', 'testimonials', 'faq', 'finalCta', 'footer', 'subpages'];
/** Keys under those roots that are not prose (links, icons, ids, image data). */
const SKIP_KEYS = new Set(['href', 'url', 'image', 'images', 'icon', 'k', 'n', 'stars', 'route', 'ctaHref', 'cols', 'legalLinks', 'social', 'stats', 'seasons', 'priceFrom']);

/** Each claim, the pattern that finds it in copy, and the pattern that finds support in facts.
 *  Support defaults to the claim's own pattern: the facts saying it is what supports it. */
const CLAIMS: Array<{ claim: string; re: RegExp; support?: RegExp }> = [
  { claim: 'same day', re: /\bsame[- ]day\b/i },
  { claim: '24/7', re: /\b24\/7\b|\b24 hours\b|\baround the clock\b/i, support: /\b24\/7\b|\b24 hours\b|\b24h\b|around the clock|all day/i },
  { claim: 'free estimate', re: /\bfree (estimate|quote|inspection|consultation)s?\b/i, support: /\bfree (estimate|quote|inspection|consultation)s?\b/i },
  { claim: 'licensed', re: /\blicen[sc]ed\b/i, support: /\blicen[sc](ed|e)\b/i },
  { claim: 'insured', re: /\binsured\b/i },
  { claim: 'bonded', re: /\bbonded\b/i },
  { claim: 'certified', re: /\bcertifi(ed|cation)\b|\bNATE\b|\bEPA 608\b/i, support: /\bcertifi(ed|cation)|\bNATE\b|\bEPA\b|\bGAF\b|\bIICRC\b|\bIDA\b/i },
  { claim: 'guarantee', re: /\bguarantee[ds]?\b/i },
  { claim: 'warranty', re: /\bwarrant(y|ies|ied)\b/i },
  { claim: 'satisfaction', re: /\b100% satisf|\bsatisfaction\b/i },
  { claim: 'no hidden fees', re: /\bno hidden (fees|costs|charges)\b/i },
  { claim: 'upfront pricing', re: /\bup-?front pric/i },
  { claim: 'family-owned', re: /\bfamily[- ](owned|run)\b/i },
  { claim: 'years in business', re: /\b(since (19|20)\d\d|\d+\+? years? (of experience|in business))\b/i, support: /\b(19|20)\d\d\b|\byears?\b/i },
  { claim: 'rating', re: /\b[45]\.\d ?(★|stars?)|\b\d+\+? (five-star |5-star )?reviews\b/i, support: /\brating\b|\breviews?\b|★/i },
  // Added with the fixed-template scan (Xander 2026-11-10, wording file section C: "Reword all to
  // promise nothing"): the promises his examples make.
  { claim: 'response time', re: /\b(in|within|under) (minutes|an hour|\d+ (minutes?|mins?|hours?))\b|\bright away\b|\bcalls? you back (in|within)\b|\balready nearby\b/i, support: /\bminutes?\b|\bhours?\b|\bsame[- ]day\b|\bright away\b/i },
  { claim: 'travel', re: /\bwe travel\b|\bwe come to you\b|\bwe(?:'|’)?ll come to you\b/i, support: /\btravel\b|\bmobile\b|\bcome to (you|the customer)\b|\bradius\b/i },
  { claim: 'no fee', re: /\bno (mobile|trip|call-?out|travel|service|diagnostic) (fee|charge)s?\b/i },
  { claim: 'flat price', re: /\bflat[- ](quote|rate|price|fee)s?\b/i },
];

/** The claims a piece of text makes, by name (the CLAIMS above). Used by the fixed-template scan
 *  (test/fixed-claims.test.mjs) on text no client fact can ever support. */
export function claimsIn(text: string): string[] {
  return CLAIMS.filter(({ re }) => re.test(text)).map(({ claim }) => claim);
}

export interface CopyRisk { path: string; text: string }
export interface ClaimRisk { path: string; claim: string; text: string }
export interface CopyRisks { presetCopy: CopyRisk[]; unsupportedClaims: ClaimRisk[] }

function walkStrings(v: unknown, path: string, out: Array<[string, string]>): void {
  if (typeof v === 'string') {
    if (v.trim()) out.push([path, v]);
    return;
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => walkStrings(x, `${path}.${i}`, out));
    return;
  }
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Json)) {
      if (SKIP_KEYS.has(k)) continue;
      walkStrings(x, path ? `${path}.${k}` : k, out);
    }
  }
}

export function getPath(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, seg) => (cur == null ? undefined : (cur as Json)[seg]), o);
}

/** Everything the client told us, as one searchable text: brand facts, extensions, the brief's
 *  own words, stats, and the per-service facts. Never the generated copy itself. */
export function factsText(content: unknown): string {
  const c = obj(content);
  const brand = obj(c.brand);
  const meta = obj(c._meta);
  const services = (Array.isArray(obj(c.services).items) ? (obj(c.services).items as unknown[]) : []).map((it) => {
    const s = obj(it);
    return { t: s.t, included: s.included, typicalJobs: s.typicalJobs, brands: s.brands, priceFrom: s.priceFrom, duration: s.duration };
  });
  // VALUES only: a serialised object would let a key name support a claim ("license": null
  // reads as the word "license", and "licensed" would pass on a client with no licence).
  const values: string[] = [];
  const collect = (v: unknown): void => {
    if (typeof v === 'string') values.push(v);
    else if (typeof v === 'number') values.push(String(v));
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') Object.values(v as Json).forEach(collect);
  };
  collect([brand.license, brand.established, c.extensions, meta.brandDirection, obj(c.about).stats, services, obj(c.trust).logos]);
  return values.join('\n');
}

export function copyRisks(content: unknown, preset: unknown): CopyRisks {
  const strings: Array<[string, string]> = [];
  const c = obj(content);
  for (const root of COPY_ROOTS) walkStrings(c[root], root, strings);

  const presetCopy: CopyRisk[] = [];
  for (const [path, text] of strings) {
    const p = getPath(preset, path);
    if (typeof p === 'string' && p.trim() === text.trim()) presetCopy.push({ path, text });
  }

  const facts = factsText(content);
  const hasLicense = typeof obj(c.brand).license === 'string' && (obj(c.brand).license as string).trim() !== '';
  const unsupportedClaims: ClaimRisk[] = [];
  for (const [path, text] of strings) {
    for (const { claim, re, support } of CLAIMS) {
      if (!re.test(text)) continue;
      const supported = (claim === 'licensed' && hasLicense) || (support ?? re).test(facts);
      if (!supported) unsupportedClaims.push({ path, claim, text });
    }
  }
  return { presetCopy, unsupportedClaims };
}

/** Every visible copy string, as [path, text], under the same roots and skips copyRisks scans.
 *  scorePage scans exactly these, so the two checks can never disagree about what is "copy". */
export function visibleCopy(content: unknown): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const c = obj(content);
  for (const root of COPY_ROOTS) walkStrings(c[root], root, out);
  return out;
}
