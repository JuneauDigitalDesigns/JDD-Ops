/**
 * Canonical URLs that must never reach a client site (2026-11-11).
 *
 * Every industry preset and the default seed used to carry a sample `seo.canonical`
 * (`data/verticals/hvac.ts` → https://yourhvaccompany.com). The Studio's effective content is
 * `preset <- imported <- generated <- edits`, and the merge reads a null as "missing", so a
 * client who skipped the website question (`seo.canonical: null`) inherited the preset's URL.
 * Copy generation then copied it into `generated` (it spreads the base's `seo`), and an export
 * would have shipped it: every page's <link rel="canonical">, the sitemap, robots.txt's Sitemap
 * line, the JSON-LD `url`/`@id` and llms.txt all naming somebody else's domain. Found on
 * Tracewell Heating & Air, whose `.draft.json` had `generated.seo.canonical` set to the HVAC
 * placeholder.
 *
 * The presets carry no canonical now, but a placeholder already written into a draft or an
 * exported repo outlives that, so this list stays: every canonical any preset, seed or template
 * has shipped. `stripPlaceholderCanonical` empties a match. It runs on the Studio's effective
 * content and again in the export route before site.ts is written. Add to the list, never
 * remove from it.
 *
 * An empty canonical is the correct state for a client with no domain yet: the site ships no
 * canonical tag and an empty sitemap until `/manage` sets the real one (the `seo.canonical*`
 * findings in lib/canonicalCheck.ts).
 *
 * CLIENT-SAFE: imported by the Studio ('use client').
 */

export const RETIRED_PLACEHOLDER_CANONICALS: readonly { url: string; from: string }[] = [
  { url: 'https://yourhvaccompany.com', from: 'data/verticals/hvac.ts' },
  { url: 'https://yourroofingcompany.com', from: 'data/verticals/roofing.ts' },
  { url: 'https://yourplumbingcompany.com', from: 'data/verticals/plumbing.ts' },
  { url: 'https://yourlawncare.com', from: 'data/verticals/lawn-care.ts' },
  { url: 'https://yourdetailingco.com', from: 'data/verticals/car-detailing.ts' },
  { url: 'https://yourwellnesspractice.com', from: 'data/verticals/health.ts' },
  { url: 'https://peakhomeservices.com', from: 'data/site.ts (the default seed)' },
  { url: 'https://example.com', from: 'template/src/data/site.ts and scripts/new-client.js' },
];

/** The bare, lowercased hostname of a URL-ish string (scheme optional, `www.` dropped), or ''. */
export function canonicalHost(value: unknown): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

const RETIRED_HOSTS = new Set(RETIRED_PLACEHOLDER_CANONICALS.map((p) => canonicalHost(p.url)));

/** True when this canonical is a preset, seed or template placeholder, not a client's domain. */
export function isPlaceholderCanonical(value: unknown): boolean {
  const host = canonicalHost(value);
  return host !== '' && RETIRED_HOSTS.has(host);
}

/**
 * A canonical as the console stores it: absolute http(s), no trailing slash, or null when the
 * value isn't a usable URL or is a placeholder. Same shape api/manage/canonical always wrote
 * (bare, because robots.ts and the JSON-LD @id append to it).
 */
export function normalizeCanonical(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || isPlaceholderCanonical(raw)) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!parsed.hostname.includes('.')) return null;
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return null;
  }
}

type WithSeo ={ seo?: { canonical?: unknown } | null };

/**
 * Empty `seo.canonical` when it is a placeholder. Returns the input untouched (same object)
 * when there is nothing to remove, and never mutates it. `removed` is the value dropped.
 */
export function stripPlaceholderCanonical<T>(content: T): { content: T; removed: string | null } {
  const seo = (content as WithSeo | null)?.seo;
  if (!seo || !isPlaceholderCanonical(seo.canonical)) return { content, removed: null };
  return {
    content: { ...content, seo: { ...seo, canonical: '' } } as T,
    removed: String(seo.canonical),
  };
}

/**
 * The canonical in clients/{slug}/site.ts wins at export, when it is a real URL.
 *
 * That file is what `/manage` writes (api/manage/canonical, the `seo.canonical*` findings), but
 * the Studio does not read it back once a client has been exported: it opens on the repo's own
 * site.ts ("disk wins", BuildWizard). Without this overlay, setting the canonical in `/manage`
 * and then re-exporting would ship the repo's old value, and the finding would never clear.
 * An empty or placeholder value there leaves the Studio's value alone.
 */
export function applyIntakeCanonical<T>(
  content: T,
  intakeCanonical: unknown,
): { content: T; replaced: { from: string; to: string } | null } {
  const to = normalizeCanonical(intakeCanonical);
  const seo = (content as WithSeo | null)?.seo;
  if (!to || !seo) return { content, replaced: null };
  const from = typeof seo.canonical === 'string' ? seo.canonical.trim() : '';
  if (normalizeCanonical(from) === to) return { content, replaced: null };
  return { content: { ...content, seo: { ...seo, canonical: to } } as T, replaced: { from, to } };
}

/**
 * Generated copy never carries a canonical (2026-11-11).
 *
 * `applyGeneratedCopy` builds `generated.seo` by spreading the base it was handed, which is the
 * Studio's effective content, so whatever canonical that held (a preset placeholder, or a real
 * one) was written into `generated`, the layer ABOVE the client's own imported value. The
 * copywriter is never asked for a canonical, so the right value for this layer is none: an empty
 * string, which the merge reads as missing and falls through to the client's own value.
 */
export function withoutCarriedCanonical<T>(generated: T): T {
  const seo = (generated as WithSeo | null)?.seo;
  if (!seo || !('canonical' in seo) || seo.canonical === '') return generated;
  return { ...generated, seo: { ...seo, canonical: '' } } as T;
}
