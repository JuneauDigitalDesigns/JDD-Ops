/**
 * Every page's title, description, canonical, social image and structured data, plus the one
 * business node (Xander's SEO decisions D7, D9 and D10, 2026-11-10).
 *
 * Computed ONCE, in the console, at export, where the vertical, the composition and the service-
 * page gate are all known, and written into the client repo as src/data/seo-pages.ts. The client
 * repo only reads it: lib/pageMetadata.ts (page metadata), lib/PageJsonLd.tsx (the page's graph),
 * lib/structuredData.ts (the business node, from the client-owned layout) and app/sitemap.ts.
 * One implementation, so the Studio's checks (scorePage) and the live site can never disagree
 * about a page's title.
 *
 * What it replaced, as measured on e2etestgrowth: every subpage titled the brand name, described
 * by the tagline and canonicalised to HOME; a sitemap of one URL; and the whole graph (a generic
 * LocalBusiness, every FAQ, every Service, self-published Review nodes) on every page.
 */
import { imageAt } from '@/lib/localImage';
import { primaryCity, serviceSlugs } from '@/lib/servicePages';
import { canonicalTown, townSlugs } from '@jdd/schema';
import { profileLinks } from '@/lib/serviceLinks';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** One page of the composition, as far as SEO cares. */
export interface SeoPageRef {
  route: string;
  pageType: string;
  label: string;
  sections: Array<{ categoryId: string }>;
}

export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  ogImage: string | null;
  jsonLd: Json[];
}

/** The most specific schema.org type per vertical. schema.org has no lawn-care type (Google:
 *  "use the most specific LocalBusiness sub-type possible"); AutoWash for detailing is a
 *  judgement call recorded in the SEO plan. */
export const BUSINESS_TYPES: Record<string, string> = {
  hvac: 'HVACBusiness',
  plumbing: 'Plumber',
  roofing: 'RoofingContractor',
  'car-detailing': 'AutoWash',
  'lawn-care': 'HomeAndConstructionBusiness',
  health: 'LocalBusiness',
};

/** What the business does, for titles ("HVAC Services in Clermont"). */
export const TRADE_LABELS: Record<string, string> = {
  hvac: 'HVAC',
  plumbing: 'Plumbing',
  roofing: 'Roofing',
  'car-detailing': 'Car Detailing',
  'lawn-care': 'Lawn Care',
  health: 'Health & Wellness',
};

function compact(o: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

const join = (parts: string[], sep: string) => parts.filter(Boolean).join(sep);

// ── Titles (D7, approved patterns) ──────────────────────────────────────────

function titleFor(content: unknown, page: SeoPageRef, trade: string, service: Json | null, town = ''): string {
  const c = obj(content);
  const brand = str(obj(c.brand).name);
  const city = primaryCity(content);
  const inCity = (what: string) => join([what, city && `in ${city}`], ' ');
  switch (page.pageType) {
    case 'home': {
      // The copywriter writes the home title in the approved form; keep it only when it IS that
      // form (ends "| {brand}" and names the city when there is one), else build it.
      const generated = str(obj(c.seo).title);
      const ok = brand && generated.endsWith(`| ${brand}`) && (!city || generated.includes(city)) && generated.length <= 70;
      return ok ? generated : join([trade ? inCity(trade) : city, brand], ' | ') || brand;
    }
    case 'services':
      // L5 (Xander, 2026-11-12, approved word for word): no city, so the Services page stops
      // aiming at home's "{Trade} in {City}".
      return join([join(['All', trade, 'Services'], ' '), brand], ' | ');
    case 'area':
      // L2/L6, approved word for word: "{Trade} in {Town} | {Brand}".
      return join([trade && town ? `${trade} in ${town}` : town || page.label, brand], ' | ');
    case 'spoke':
      // Approved word for word: "{Service} in {Town} | {Brand}".
      return join([join([str(service?.t) || page.label, town && `in ${town}`], ' '), brand], ' | ');
    case 'about':
      return join([join(['About', brand], ' '), trade ? inCity(trade) : city], ' | ');
    case 'contact':
      return join([join(['Contact', brand], ' '), join([city, trade], ' ')], ' | ');
    case 'service':
      return join([inCity(str(service?.t) || page.label), brand], ' | ');
    default:
      return str(obj(obj(obj(c.subpages)[page.route]).seo).title) || join([page.label, brand], ' | ');
  }
}

// ── Business node (D10) ─────────────────────────────────────────────────────

const DAYS: Record<string, string> = {
  mon: 'Monday', monday: 'Monday', tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', weds: 'Wednesday', wednesday: 'Wednesday', thu: 'Thursday', thur: 'Thursday',
  thurs: 'Thursday', thursday: 'Thursday', fri: 'Friday', friday: 'Friday', sat: 'Saturday',
  saturday: 'Saturday', sun: 'Sunday', sunday: 'Sunday',
};

/** "9:00 AM" | "9am" | "17:00" -> "09:00"; '' if unparseable. */
function to24h(raw: string): string {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(raw.trim().toLowerCase().replace(/\./g, ''));
  if (!m) return '';
  let h = Number(m[1]);
  const min = m[2] ?? '00';
  if (h > 23 || Number(min) > 59) return '';
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/** Per-day hours only. A single "all" string ("Mon-Fri 8am - 5pm") can't be mapped to days
 *  reliably, so it is left out rather than asserted wrongly; malformed hours can invalidate the
 *  whole entity. */
function openingHours(hours: Json): Json[] {
  const out: Json[] = [];
  for (const [rawDay, rawVal] of Object.entries(hours)) {
    const day = DAYS[rawDay.trim().toLowerCase()];
    const val = str(rawVal);
    if (!day || !val || /closed/i.test(val)) continue;
    if (/24\s*(hours|hrs|h)|all day|always/i.test(val)) {
      out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${day}`, opens: '00:00', closes: '23:59' });
      continue;
    }
    const parts = val.split(/\s*(?:-|–|—|\bto\b)\s*/i);
    const opens = parts.length >= 2 ? to24h(parts[0]) : '';
    const closes = parts.length >= 2 ? to24h(parts[1]) : '';
    if (opens && closes) out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${day}`, opens, closes });
  }
  return out;
}

/** "12 Main St, Clermont, FL 34711" -> PostalAddress. A service-area business (Google: "you
 *  should hide your business address") keeps locality, region and ZIP only. */
function postalAddress(address: string, hideStreet: boolean): Json | undefined {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  const last = parts[parts.length - 1];
  const m = /^([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/.exec(last);
  const region = m ? m[1] : '';
  const zip = m?.[2] ?? '';
  const rest = m ? parts.slice(0, -1) : parts;
  const locality = rest.length >= 2 ? rest[rest.length - 1] : rest.length === 1 && m ? rest[0] : '';
  const street = rest.length >= 2 ? rest.slice(0, -1).join(', ') : rest.length === 1 && !m ? rest[0] : '';
  const node = compact({
    '@type': 'PostalAddress',
    streetAddress: hideStreet ? undefined : street || undefined,
    addressLocality: locality || undefined,
    addressRegion: region || undefined,
    postalCode: zip || undefined,
  });
  return Object.keys(node).length > 1 ? node : undefined;
}

function baseUrl(content: unknown): string {
  const raw = str(obj(obj(content).seo).canonical);
  return /^https?:\/\//i.test(raw) ? raw.replace(/\/+$/, '') : '';
}

const places = (towns: unknown) => arr(towns).map(str).filter(Boolean).map((name) => ({ '@type': 'Place', name }));

export function businessNode(content: unknown, vertical: string | null): Json {
  const c = obj(content);
  const brand = obj(c.brand);
  const ext = obj(c.extensions);
  const base = baseUrl(content);
  const sab = ext.serviceAreaBusiness === true;
  const hero = arr(obj(obj(c.images).hero).slides).map(obj)[0];
  return compact({
    '@type': BUSINESS_TYPES[vertical ?? ''] ?? 'LocalBusiness',
    '@id': base ? `${base}#business` : undefined,
    name: str(brand.long) || str(brand.name),
    description: str(obj(c.seo).description) || str(brand.tagline),
    telephone: str(brand.phone),
    email: str(brand.email),
    url: base || undefined,
    image: hero && str(hero.url) ? imageAt(str(hero.url), 1536) : undefined,
    foundingDate: str(brand.established) || undefined,
    address: postalAddress(str(brand.address), sab),
    areaServed: places(ext.serviceArea),
    // Exactly the footer's "Find us on" list (lib/serviceLinks.ts), so the two always agree.
    sameAs: profileLinks(content).map((l) => l.url),
    openingHoursSpecification: openingHours(obj(ext.hours)),
    // NO aggregateRating / review (D10): Google makes a business's reviews of itself ineligible
    // for review snippets. The visible review badge stays.
  });
}

// ── Page nodes ──────────────────────────────────────────────────────────────

function faqNode(items: unknown[]): Json | null {
  const qa = items.map(obj).filter((it) => str(it.q) && str(it.a));
  if (!qa.length) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: qa.map((it) => ({ '@type': 'Question', name: str(it.q), acceptedAnswer: { '@type': 'Answer', text: str(it.a) } })),
  };
}

function firstSentence(text: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(text.trim());
  return (m ? m[1] : text).trim();
}

function priceNumber(raw: string): number | null {
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(raw);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function buildPageSeo(content: unknown, pages: SeoPageRef[], vertical: string | null): Record<string, PageSeo> {
  const c = obj(content);
  const base = baseUrl(content);
  const trade = TRADE_LABELS[vertical ?? ''] ?? '';
  const brandName = str(obj(c.brand).name);
  const items = arr(obj(c.services).items).map(obj);
  const slugs = serviceSlugs(content);
  const heroImage = str(arr(obj(obj(c.images).hero).slides).map(obj)[0]?.url);
  const businessId = base ? { '@id': `${base}#business` } : undefined;
  const out: Record<string, PageSeo> = {};

  // Local SEO (L2): a town page is areas/<townSlug>, a spoke areas/<townSlug>/<serviceSlug>.
  const area = arr(obj(c.extensions).serviceArea).map(str).filter(Boolean);
  const tSlugs = townSlugs(content);
  const hasAreasIndex = pages.some((p) => p.route === 'areas');
  const areaCopy = obj(c.areaCopy);

  for (const page of pages) {
    const parts = page.route.split('/');
    const isArea = page.pageType === 'area' && parts.length === 2;
    const isSpoke = page.pageType === 'spoke' && parts.length === 3;
    const townSlug = isArea || isSpoke ? parts[1] : '';
    const town = townSlug && tSlugs.includes(townSlug) ? area[tSlugs.indexOf(townSlug)] : '';
    const serviceSlug = page.pageType === 'service' ? parts.slice(1).join('/') : isSpoke ? parts[2] : '';
    const idx = serviceSlug ? slugs.indexOf(serviceSlug) : -1;
    const service = idx >= 0 ? items[idx] : null;
    const url = base ? (page.route ? `${base}/${page.route}` : base) : '';
    const sub = obj(obj(obj(c.subpages)[page.route]).seo);
    const townCopy = obj(areaCopy[townSlug]);
    const localIntro = isArea ? str(townCopy.intro) : isSpoke ? str(obj(obj(townCopy.spokes)[serviceSlug]).intro) : '';
    const description =
      (page.route === '' ? str(obj(c.seo).description) : str(sub.description)) ||
      firstSentence(localIntro) ||
      (service ? str(service.d) : '') ||
      str(obj(c.brand).tagline);
    // A town page's social image is its own first job in that town (a spoke's, of that service).
    const townJob = town
      ? arr(obj(c.work).projects).map(obj).find((p) => canonicalTown(content, p.town) === town && str(obj(p.image).url) && (!isSpoke || str(p.service) === serviceSlug))
      : undefined;
    const image = isArea || isSpoke ? str(obj(townJob?.image).url) : service ? str(obj(service.image).url) : '';

    const jsonLd: Json[] = [];
    if (page.route !== '') {
      const crumbs: Array<[string, string]> = [['Home', base]];
      if (page.pageType === 'service') crumbs.push(['Services', base ? `${base}/services` : '']);
      // Approved breadcrumb "Home › Areas › {Town} › {Service}"; "Areas" only when the index exists.
      if ((isArea || isSpoke) && hasAreasIndex) crumbs.push(['Areas', base ? `${base}/areas` : '']);
      if (isSpoke) crumbs.push([town || page.label, base ? `${base}/areas/${townSlug}` : '']);
      crumbs.push([isArea ? town || page.label : service ? str(service.t) || page.label : page.label, url]);
      jsonLd.push({
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map(([name, item], i) => compact({ '@type': 'ListItem', position: i + 1, name, item: item || undefined })),
      });
    }
    if (isSpoke && service) {
      // A spoke: this service in this one town. No price and no FAQ, because the spoke shows
      // neither (they stay on the service page), and markup must match the visible page.
      jsonLd.push(compact({
        '@type': 'Service',
        name: str(service.t),
        serviceType: str(service.t),
        description: firstSentence(localIntro) || str(service.d),
        url: url || undefined,
        provider: businessId ?? { '@type': BUSINESS_TYPES[vertical ?? ''] ?? 'LocalBusiness', name: brandName },
        areaServed: places(town ? [town] : []),
      }));
    } else if (isArea) {
      // A town page carries its breadcrumb only. The business node already lists every town in
      // areaServed, and no town gets a LocalBusiness or an address of its own.
    } else if (service) {
      const pageCopy = obj(service.page);
      const price = priceNumber(str(service.priceFrom));
      jsonLd.push(compact({
        '@type': 'Service',
        name: str(service.t),
        serviceType: str(service.t),
        description: firstSentence(str(pageCopy.intro)) || str(service.d),
        url: url || undefined,
        provider: businessId ?? { '@type': BUSINESS_TYPES[vertical ?? ''] ?? 'LocalBusiness', name: brandName },
        areaServed: places(service.areas), // own towns only (Xander, 2026-11-10)
        offers: price !== null
          ? { '@type': 'Offer', priceSpecification: { '@type': 'PriceSpecification', minPrice: price, priceCurrency: 'USD' } }
          : undefined,
      }));
      const tagged = arr(obj(c.extensions).customerQuestions).map(obj).filter((q) => str(q.service) === slugs[idx]);
      const faq = faqNode([...tagged, ...arr(pageCopy.faq)]);
      if (faq) jsonLd.push(faq);
    } else if (page.sections.some((s) => s.categoryId === 'faq')) {
      // FAQPage only where those FAQs are visible (Google structured-data policy).
      const faq = faqNode(arr(obj(c.faq).items));
      if (faq) jsonLd.push(faq);
    }

    out[page.route] = {
      title: titleFor(content, page, trade, service, town),
      description,
      canonical: url,
      ogImage: image || heroImage ? imageAt(image || heroImage, 1536) : null,
      jsonLd,
    };
  }
  return out;
}

/** The client repo's src/data/seo-pages.ts. Data only (JSON), "<" escaped so no value can ever
 *  close a script tag where PageJsonLd inlines it. */
export function seoPagesSource(pages: Record<string, PageSeo>, business: Json | null): string {
  const lit = (v: unknown) => JSON.stringify(v, null, 2).replace(/</g, '\\u003c');
  return [
    '// Written by the JDD console on every export (lib/pageSeo.ts). Do not edit: it is regenerated.',
    '// Each page\'s title, description, canonical, social image and structured data, and the',
    '// business node. Read by lib/pageMetadata.ts, lib/PageJsonLd.tsx, lib/structuredData.ts and',
    '// app/sitemap.ts.',
    '',
    'export interface PageSeo {',
    '  title: string;',
    '  description: string;',
    '  canonical: string;',
    '  ogImage: string | null;',
    '  jsonLd: Record<string, unknown>[];',
    '}',
    '',
    `export const PAGE_SEO: Record<string, PageSeo> = ${lit(pages)};`,
    '',
    `export const BUSINESS_JSONLD: Record<string, unknown> | null = ${lit(business)};`,
    '',
  ].join('\n');
}
