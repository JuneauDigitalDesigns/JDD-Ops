/**
 * Is the site's canonical URL a domain Vercel actually serves it on? (2026-11-11)
 *
 * A client who skipped the website question has no canonical, and until this PR the Studio
 * filled the gap with the industry preset's sample (https://yourhvaccompany.com), so every page
 * would have named somebody else's domain as its real address. The presets carry none now
 * (lib/placeholderCanonical.ts), which leaves a provisioned client with an EMPTY canonical: no
 * canonical tag, an empty sitemap, no Sitemap line in robots.txt. That is correct until the
 * site has an address, and the address is only known after onboarding, from Vercel. So the
 * reconcile sweep reports it here, with a button that sets it.
 *
 * Pure, and fed only what the sweep already has: the one `listProjectDomains` call it makes per
 * site anyway. No call of its own, nothing per key.
 *
 * `ok` is true | false | null, and null ("could not check": Vercel unreachable, no project, no
 * domain to compare with) is never a pass. The sweep's other findings already name each of
 * those causes (vercel.unchecked, vercel.projectMissing, site.noUrl), so null adds no row.
 *
 * Two canonicals, because they live in two files:
 *   - `shipped`: the client repo's src/data/site.ts, what the last export or onboarding run
 *     wrote, i.e. what the site serves. `undefined` when there is no readable repo copy.
 *   - `intake`: clients/{slug}/site.ts, what /manage writes and what the export now carries
 *     over the Studio's value (applyIntakeCanonical).
 *
 * CLIENT-SAFE (no server-only imports), so the test runs the real function.
 */
import type { Finding } from '@jdd/schema';
import { resolveLiveUrl, type ProjectDomain } from './liveUrl';
import { normalizeCanonical } from './placeholderCanonical';

export interface CanonicalCheckInput {
  /** The client's base slug (api/manage/canonical's `slug`). */
  slug: string;
  /** This site's slug (its `site`). */
  siteSlug: string;
  shipped: string | null | undefined;
  intake: string | null;
  /** listProjectDomains' result, or null when the call itself failed. */
  domains: { ok: boolean; domains: ProjectDomain[] } | null;
}

export interface CanonicalCheck {
  ok: boolean | null;
  finding: Finding | null;
}

/** Exact lowercased hostname, `www.` kept: a canonical on a redirecting host is still wrong. */
function hostOf(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function checkCanonical(input: CanonicalCheckInput): CanonicalCheck {
  const { slug, siteSlug, domains } = input;
  if (!domains || !domains.ok) return { ok: null, finding: null };

  // The same ranking the domain tiles use: a verified custom domain, else the vercel.app alias.
  const expected = resolveLiveUrl(domains.domains, null).url;
  if (!expected) return { ok: null, finding: null };

  const raw = (input.shipped !== undefined ? input.shipped : input.intake) ?? '';
  const current = raw.trim();
  if (normalizeCanonical(current) && hostOf(normalizeCanonical(current)) === hostOf(expected)) {
    return { ok: true, finding: null };
  }

  const golive = 'Setting it writes site.ts. It goes live with the next export and deploy from Build.';
  const fix = { route: '/api/manage/canonical', body: { slug, site: siteSlug, canonical: expected }, label: `Set to ${expected}` };

  // Already set in site.ts, just not exported yet: nothing to click, only to deploy.
  const intake = normalizeCanonical(input.intake);
  if (intake && hostOf(intake) === hostOf(expected)) {
    return {
      ok: false,
      finding: {
        id: 'seo.canonicalNotLive',
        severity: 'amber',
        area: 'site',
        siteSlug,
        title: 'New canonical URL not live yet',
        detail: `site.ts has ${intake}, but the site still ships ${current || 'no canonical'}. Export and deploy from Build to put it live.`,
        expected: intake,
        actual: current || '(none)',
      },
    };
  }

  if (!current) {
    return {
      ok: false,
      finding: {
        id: 'seo.canonicalMissing',
        severity: 'amber',
        area: 'site',
        siteSlug,
        title: 'No canonical URL',
        detail: `Pages ship with no canonical tag and the sitemap is empty. This site is served at ${expected}. ${golive}`,
        expected,
        actual: '(none)',
        fix,
      },
    };
  }

  return {
    ok: false,
    finding: {
      id: 'seo.canonicalWrong',
      severity: 'red',
      area: 'site',
      siteSlug,
      title: `Canonical URL points at ${hostOf(/^https?:\/\//i.test(current) ? current : `https://${current}`) || current}`,
      detail: `Every page tells search engines its address is ${current}, which this Vercel project does not serve. It is served at ${expected}. ${golive}`,
      expected,
      actual: current,
      fix,
    },
  };
}
