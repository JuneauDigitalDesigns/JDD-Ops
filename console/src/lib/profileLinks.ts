// The client's own profile links, in display order, and the address a site may show (SEO plan
// D11, approved by Xander 2026-11-10; service-page spec §6).
//
// BYTE-IDENTICAL in console/src/lib and template/src/lib (test/profile-links.test.mjs). One list
// feeds the "Find us on" footer block (lib/FindUsOn.tsx) and the business node's sameAs
// (console lib/pageSeo.ts), so the site never links a profile it doesn't tell Google about, or
// the reverse. Reads content structurally: extensions.profiles arrives with @jdd/schema v1.32.0.

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export type ProfileKind = 'google' | 'facebook' | 'yelp' | 'bbb' | 'angi' | 'nextdoor' | 'instagram' | 'other';

/** Google Business Profile first: the strongest local signal, and the most-cited source in AI
 *  answers for local queries (BrightLocal 2026). Then the directories AI answers cite next. */
export const PROFILE_ORDER: ProfileKind[] = ['google', 'facebook', 'yelp', 'bbb', 'angi', 'nextdoor', 'instagram', 'other'];

const LABELS: Record<Exclude<ProfileKind, 'other'>, string> = {
  google: 'Google',
  facebook: 'Facebook',
  yelp: 'Yelp',
  bbb: 'BBB',
  angi: 'Angi',
  nextdoor: 'Nextdoor',
  instagram: 'Instagram',
};

/** The hosts a link of each kind may live on. A link whose host doesn't match its kind is a
 *  typo or a mislabel, and is left out rather than published under the wrong name. */
const HOSTS: Record<Exclude<ProfileKind, 'other'>, RegExp> = {
  google: /(^|\.)(google\.[a-z.]+|goo\.gl|g\.page)$/i,
  facebook: /(^|\.)(facebook\.com|fb\.com)$/i,
  yelp: /(^|\.)yelp\.[a-z.]+$/i,
  bbb: /(^|\.)bbb\.org$/i,
  angi: /(^|\.)(angi\.com|angieslist\.com|homeadvisor\.com)$/i,
  nextdoor: /(^|\.)nextdoor\.com$/i,
  instagram: /(^|\.)instagram\.com$/i,
};

export interface ProfileLink {
  kind: ProfileKind;
  label: string;
  url: string;
}

export function profileLinks(content: unknown): ProfileLink[] {
  const raw = obj(obj(content).extensions).profiles;
  const list = Array.isArray(raw) ? raw.map(obj) : [];
  const seen = new Set<string>();
  const out: ProfileLink[] = [];
  for (const p of list) {
    const kind = (PROFILE_ORDER as string[]).includes(str(p.kind)) ? (str(p.kind) as ProfileKind) : 'other';
    let url: URL;
    try {
      url = new URL(str(p.url));
    } catch {
      continue;
    }
    if (url.protocol !== 'https:') continue;
    const host = url.hostname.toLowerCase();
    if (kind !== 'other' && !HOSTS[kind].test(host)) continue;
    // A Google search results page is not a profile.
    if (/(^|\.)google\.[a-z.]+$/i.test(host) && url.pathname.startsWith('/search')) continue;
    const href = url.toString();
    if (seen.has(href)) continue;
    seen.add(href);
    const label = kind === 'other' ? str(p.label) || host.replace(/^www\./, '') : LABELS[kind];
    out.push({ kind, label, url: href });
  }
  return out.sort((a, b) => PROFILE_ORDER.indexOf(a.kind) - PROFILE_ORDER.indexOf(b.kind));
}

/** The address the site may print. A service-area business hides its street (Google: "If you're
 *  a service-area business, you should hide your business address"), keeping city, state and ZIP. */
export function siteAddress(content: unknown): string {
  const c = obj(content);
  const address = str(obj(c.brand).address);
  if (obj(c.extensions).serviceAreaBusiness !== true) return address;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.filter((p) => !/^\d/.test(p)).join(', ');
  return parts.slice(-2).join(', ');
}
