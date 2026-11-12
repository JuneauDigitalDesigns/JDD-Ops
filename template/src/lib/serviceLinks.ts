/**
 * Per-service pages, as the catalog components see them (service-page-spec.md, Xander 2026-11-10).
 *
 * KEEP IN STEP: this file is byte-identical in console/src/lib and template/src/lib, because the
 * catalog components import it in the Studio preview AND in every client repo
 * (console/test/service-pages.test.mjs). Client repos have no @jdd/schema dependency, so it reads
 * content structurally and imports nothing.
 *
 * `serviceSlugs` and `primaryCity` repeat the console's gate (src/lib/servicePages.ts) on purpose:
 * that module can't ship to a client repo. The test runs both over the same content and fails if
 * they ever disagree, which would point a link at a page that doesn't exist.
 *
 * Which services HAVE a page is decided by the composition, not by content. The export writes the
 * slugs into `content.servicePages` (as it writes `nav`), and the Studio injects the same list into
 * its preview. A service not in that list is linked from nowhere (Xander, 2026-11-10).
 */

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const filled = (v: unknown): string[] => arr(v).map(str).filter(Boolean);

const STOP_WORDS = new Set(['and', 'with', 'for', 'of', 'the', 'a', 'an', 'in', 'on', 'to', 'or']);
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STATE_ZIP = /^[a-z]{2}(\s+\d{5}(-\d{4})?)?$/i;

function slugBase(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/\bnear\s+me\b/g, ' ')
    .replace(/&/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w !== 'and');
  const five = words.slice(0, 5);
  while (five.length > 1 && STOP_WORDS.has(five[five.length - 1])) five.pop();
  return five.join('-').slice(0, 60).replace(/-+$/, '') || 'service';
}

function serviceSlug(item: Json, used: Set<string>): string {
  const stored = str(item.slug);
  const base = stored && SLUG_RE.test(stored) && stored.length <= 60 ? stored : slugBase(str(item.t));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Every service's URL slug, in services.items order, collision-free. Same as the console's gate. */
export function serviceSlugs(content: unknown): string[] {
  const out: string[] = [];
  for (const it of arr(obj(obj(content).services).items)) out.push(serviceSlug(obj(it), new Set(out)));
  return out;
}

/** The one city service-page H1s name: the address locality, else the first service-area town. */
export function primaryCity(content: unknown): string {
  const c = obj(content);
  const parts = str(obj(c.brand).address).split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const locality = STATE_ZIP.test(last) ? parts[parts.length - 2] : last;
    if (locality && !/\d/.test(locality)) return locality;
  }
  return filled(obj(c.extensions).serviceArea)[0] ?? '';
}

export const servicePageHref = (slug: string) => `/services/${slug}`;

/** One service, by its index in services.items (the ORIGINAL index, for `<E p>` edit paths). */
export type ServiceRef = { index: number; slug: string; t: string; tag: string; href: string | null; item: Json };

/** Every non-blank service, in order, with its page href when it has one (else null). */
export function serviceRefs(content: unknown): ServiceRef[] {
  const slugs = serviceSlugs(content);
  const pages = new Set(filled(obj(content).servicePages));
  return arr(obj(obj(content).services).items)
    .map((raw, index) => {
      const item = obj(raw);
      const slug = slugs[index];
      return { index, slug, t: str(item.t), tag: str(item.tag), href: pages.has(slug) ? servicePageHref(slug) : null, item };
    })
    .filter((s) => s.t !== '');
}

/** The services that have their own page, in services.items order: the Services menu's links. */
export function linkedServices(content: unknown): ServiceRef[] {
  return serviceRefs(content).filter((s) => s.href !== null);
}

/**
 * The anchor id of one services.items entry (its slug), for a list that iterates the items itself.
 * The footer links a service without its own page to `/services#<slug>` (footerColumns).
 */
export function serviceAnchor(content: unknown, item: unknown): string {
  const i = arr(obj(obj(content).services).items).indexOf(item);
  return i < 0 ? '' : serviceSlugs(content)[i];
}

/** One footer link. `path` is where its label lives, for the Studio's inline edit. */
export type FooterLink = { label: string; href: string; path: string };
export type FooterColumn = { h: string; links: FooterLink[] };

/**
 * The footer's link columns, built from what the site actually has (Xander, 2026-11-11):
 * - Services: every service, linking to its own page when it has one, else to the Services page
 *   scrolled to its card (each services list gives each card id="<slug>").
 * - Company: the top menu's pages except Home (Services, About, Contact), named as the menu names
 *   them. The menu is generated from the composition, so it only ever lists pages that exist.
 * An empty column is left out. `footer.cols` is not read: the presets' sample columns ("Our Work",
 * "Reviews", sample services) shipped on Tracewell's test site and linked pages that don't exist.
 */
export function footerColumns(content: unknown): FooterColumn[] {
  const nav = arr(obj(content).nav).map((n, i) => ({ label: str(obj(n).label), href: str(obj(n).href), path: `nav.${i}.label` }));
  // The Services page; on a one-page site (no /services in the menu) the cards are on this page.
  const servicesPage = nav.some((n) => n.href === '/services') ? '/services' : '';
  const services = serviceRefs(content).map((s) => ({
    label: s.t,
    href: s.href ?? `${servicesPage}#${s.slug}`,
    path: `services.items.${s.index}.t`,
  }));
  const company = nav.filter((n) => n.label && n.href && n.href !== '/' && n.href !== '#' && n.href !== '#top');
  return [
    { h: 'Services', links: services },
    { h: 'Company', links: company },
  ].filter((c) => c.links.length > 0);
}

/** The service a service page is for, or null (unknown slug: the section renders nothing). */
export function serviceBySlug(content: unknown, slug: string | undefined): ServiceRef | null {
  if (!slug) return null;
  return serviceRefs(content).find((s) => s.slug === slug) ?? null;
}

/** "{service} in {city}", or the bare service name when there is no city. */
export function serviceHeadline(content: unknown, s: ServiceRef): { t: string; city: string } {
  return { t: s.t, city: primaryCity(content) };
}

/** 2–3 sibling services that have pages, same tag first. Never this service; never a section-only one. */
export function relatedServices(content: unknown, s: ServiceRef, max = 3): ServiceRef[] {
  const others = linkedServices(content).filter((o) => o.index !== s.index);
  const same = others.filter((o) => o.tag && o.tag === s.tag);
  return [...same, ...others.filter((o) => !same.includes(o))].slice(0, max);
}

/** A list field on the service, non-blank entries, each with its ORIGINAL index for the edit path. */
export function serviceList(s: ServiceRef, key: string): { text: string; i: number }[] {
  return arr(s.item[key])
    .map((v, i) => ({ text: str(v), i }))
    .filter((x) => x.text !== '');
}

export type ServiceQuestion = { q: string; a: string; path: string };

/**
 * The page's questions, 3–5 (spec §3 block 10): the client's own questions tagged to this service
 * that carry an answer, then the generated `page.faq`, deduplicated by question, at most five.
 */
export function serviceQuestions(content: unknown, s: ServiceRef, max = 5): ServiceQuestion[] {
  const out: ServiceQuestion[] = [];
  const seen = new Set<string>();
  const push = (q: string, a: string, path: string) => {
    const key = q.toLowerCase();
    if (!q || !a || seen.has(key) || out.length >= max) return;
    seen.add(key);
    out.push({ q, a, path });
  };
  arr(obj(obj(content).extensions).customerQuestions).forEach((raw, i) => {
    const x = obj(raw);
    if (str(x.service) === s.slug) push(str(x.q), str(x.a), `extensions.customerQuestions.${i}`);
  });
  arr(obj(s.item.page).faq).forEach((raw, i) => {
    const x = obj(raw);
    push(str(x.q), str(x.a), `services.items.${s.index}.page.faq.${i}`);
  });
  return out;
}

export type ServiceReview = { q: string; a: string; r: string; path: string };
export type ServicePhoto = { url: string; alt: string; title: string; meta: string; path: string };

/**
 * Proof (spec §3 block 11): real reviews and job photos tagged to this service, never the site's
 * whole set. A tagged project whose photo IS the service's main photo is skipped: the onboarding
 * wizard files photo 1 as both, and the header already shows it (agreed with onboarding-facts).
 */
export function serviceProof(content: unknown, s: ServiceRef): { reviews: ServiceReview[]; photos: ServicePhoto[] } {
  const c = obj(content);
  const main = str(obj(s.item.image).url);
  const reviews = arr(obj(c.testimonials).items)
    .map((raw, i) => ({ x: obj(raw), i }))
    .filter(({ x }) => str(x.service) === s.slug && str(x.q) !== '')
    .map(({ x, i }) => ({ q: str(x.q), a: str(x.a), r: [str(x.company), str(x.r)].filter(Boolean).join(' · '), path: `testimonials.items.${i}` }));
  const photos = arr(obj(c.work).projects)
    .map((raw, i) => ({ x: obj(raw), i }))
    .filter(({ x }) => str(x.service) === s.slug && str(obj(x.image).url) !== '' && str(obj(x.image).url) !== main)
    .map(({ x, i }) => ({
      url: str(obj(x.image).url),
      alt: str(obj(x.image).alt) || str(x.t) || s.t,
      title: str(x.t),
      meta: [str(x.loc), str(x.yr)].filter(Boolean).join(' · '),
      path: `work.projects.${i}`,
    }));
  return { reviews, photos };
}

/** The header photo: the service's own image, else its first tagged job photo, else none. */
export function servicePhoto(content: unknown, s: ServiceRef): { url: string; alt: string } | null {
  const img = obj(s.item.image);
  if (str(img.url)) return { url: str(img.url), alt: str(img.alt) || s.t };
  const job = arr(obj(obj(content).work).projects).map(obj).find((x) => str(x.service) === s.slug && str(obj(x.image).url));
  return job ? { url: str(obj(job.image).url), alt: str(obj(job.image).alt) || s.t } : null;
}

/** The closing form's prefilled message on a service page (Xander 2026-11-10). */
export const serviceMessage = (s: ServiceRef) => `Service: ${s.t}`;

/** Profile links for the footer's "Find us on" block (D11): Google first, then the rest in order.
 *  THE one list: every footer's block and the structured data's sameAs (console lib/pageSeo.ts)
 *  read it, so the site never links a profile it doesn't tell Google about, or the reverse.
 *  Only real profiles: https, a host that matches the kind (a typo or a mislabelled link is left
 *  out, not published under the wrong name), never a Google search page, no duplicates. */
export const PROFILE_ORDER = ['google', 'facebook', 'yelp', 'bbb', 'angi', 'nextdoor', 'instagram', 'other'] as const;
export type ProfileKind = (typeof PROFILE_ORDER)[number];
const PROFILE_HOSTS: Record<Exclude<ProfileKind, 'other'>, RegExp> = {
  google: /(^|\.)(google\.[a-z.]+|goo\.gl|g\.page)$/i,
  facebook: /(^|\.)(facebook\.com|fb\.com)$/i,
  yelp: /(^|\.)yelp\.[a-z.]+$/i,
  bbb: /(^|\.)bbb\.org$/i,
  angi: /(^|\.)(angi\.com|angieslist\.com|homeadvisor\.com)$/i,
  nextdoor: /(^|\.)nextdoor\.com$/i,
  instagram: /(^|\.)instagram\.com$/i,
};
export function profileLinks(content: unknown): { kind: ProfileKind; url: string; label: string; path: string }[] {
  const LABEL: Record<ProfileKind, string> = {
    google: 'Google', facebook: 'Facebook', yelp: 'Yelp', bbb: 'BBB', angi: 'Angi', nextdoor: 'Nextdoor', instagram: 'Instagram', other: '',
  };
  const seen = new Set<string>();
  return arr(obj(obj(content).extensions).profiles)
    .map((raw, i) => {
      const x = obj(raw);
      const kind = (PROFILE_ORDER as readonly string[]).includes(str(x.kind)) ? (str(x.kind) as ProfileKind) : 'other';
      const url = str(x.url);
      let host = '';
      let path = '';
      try { const u = new URL(url); host = u.hostname.toLowerCase(); path = u.pathname; } catch { /* not a URL */ }
      const ok =
        /^https:\/\//i.test(url) && host !== '' &&
        (kind === 'other' || PROFILE_HOSTS[kind].test(host)) &&
        !(/(^|\.)google\.[a-z.]+$/i.test(host) && path.startsWith('/search'));
      return { kind, url, label: str(x.label) || LABEL[kind] || host.replace(/^www\./, ''), path: `extensions.profiles.${i}`, ok };
    })
    .filter((p) => p.ok && p.label && !seen.has(p.url) && Boolean(seen.add(p.url)))
    .sort((a, b) => PROFILE_ORDER.indexOf(a.kind) - PROFILE_ORDER.indexOf(b.kind))
    .map(({ ok: _ok, ...p }) => p);
}

/** True when the business is service-area only: the street is never shown (GBP rule, D11). */
export const isServiceAreaBusiness = (content: unknown) => obj(obj(content).extensions).serviceAreaBusiness === true;

/** The address as the site may show it: without the street for a service-area business. */
export function displayAddress(content: unknown): string {
  const address = str(obj(obj(content).brand).address);
  if (!isServiceAreaBusiness(content)) return address;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join(', ') : '';
}
