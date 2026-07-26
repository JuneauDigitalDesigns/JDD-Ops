// Build the schema.org JSON-LD graph for a client site.
//
// WHY THIS LIVES IN THE TEMPLATE, AND AT THE LAYOUT LEVEL
// The console's catalog SEO components also contained a JSON-LD block, but it never shipped:
// wirePage() injects only `export { generateMetadata }` at the @studio:metadata anchor, and
// `seo` is not a BODY_SLOT, so those components' default exports were never imported. Every
// client site went out with zero structured data. layout.tsx, by contrast, is copied
// verbatim by copyTemplate() and needs no wiring, so emitting here reaches every client
// regardless of which SEO variant was picked.
//
// DEFENSIVE BY DESIGN
// Two different `site.ts` shapes reach this code. The template ships a reduced placeholder
// type (no `extensions`, `work`, `images`), while an exported client repo gets the full
// @jdd/schema shape inlined via SITE_TYPES_SOURCE. So this reads structurally through
// optional access rather than importing a type, and every node is omitted unless the data
// backing it is actually present — an absent field must produce no node, never a node with
// null fields, which is worse than no markup at all.

type Json = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});

/** Drop keys whose value is empty, so a node never carries nulls. */
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

const DAYS: Record<string, string> = {
  mon: 'Monday', monday: 'Monday',
  tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', weds: 'Wednesday', wednesday: 'Wednesday',
  thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
  fri: 'Friday', friday: 'Friday',
  sat: 'Saturday', saturday: 'Saturday',
  sun: 'Sunday', sunday: 'Sunday',
};

/**
 * "9:00 AM" | "9am" | "17:00" -> "09:00". Returns '' if unparseable.
 *
 * The previous implementation just split the range on "-" and passed the halves straight
 * through, so a perfectly ordinary "9:00 AM - 5:00 PM" emitted opens:"9:00 AM" where Google
 * requires 24-hour HH:MM — and "Closed" became opens:"Closed", closes:"Closed". Malformed
 * openingHoursSpecification can invalidate the whole entity, so this is worth doing properly.
 */
function to24h(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\./g, '');
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(s);
  if (!m) return '';
  let h = Number(m[1]);
  const min = m[2] ?? '00';
  const mer = m[3];
  if (h > 23 || Number(min) > 59) return '';
  if (mer === 'pm' && h < 12) h += 12;
  if (mer === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

function openingHours(hours: Json): Json[] {
  const out: Json[] = [];
  for (const [rawDay, rawVal] of Object.entries(hours)) {
    const day = DAYS[rawDay.trim().toLowerCase()];
    const val = str(rawVal);
    if (!day || !val) continue;

    const low = val.toLowerCase();
    if (low.includes('closed')) continue; // omit rather than emit a bogus range

    if (/24\s*(hours|hrs|h)|all day|always/.test(low)) {
      out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${day}`, opens: '00:00', closes: '23:59' });
      continue;
    }

    // en dash / em dash / hyphen / "to"
    const parts = val.split(/\s*(?:[-–—]|\bto\b)\s*/i);
    if (parts.length < 2) continue;
    const opens = to24h(parts[0]);
    const closes = to24h(parts[1]);
    if (!opens || !closes) continue;

    out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${day}`, opens, closes });
  }
  return out;
}

/** Split "123 Main St, Juneau, AK 99801" into PostalAddress parts. Best-effort. */
function postalAddress(address: string): Json {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const node: Json = { '@type': 'PostalAddress', streetAddress: address };
  if (parts.length >= 2) {
    node.streetAddress = parts[0];
    node.addressLocality = parts[1];
    const region = parts[2] ?? '';
    const m = /^([A-Za-z]{2})\s*(\S+)?$/.exec(region.trim());
    if (m) {
      node.addressRegion = m[1];
      if (m[2]) node.postalCode = m[2];
    } else if (region) {
      node.addressRegion = region;
    }
  }
  return compact(node);
}

export function buildJsonLd(content: unknown): Json | null {
  const c = obj(content);
  const brand = obj(c.brand);
  const seo = obj(c.seo);
  const ext = obj(c.extensions);

  const name = str(brand.long) || str(brand.name);
  if (!name) return null; // nothing worth asserting

  const url = str(seo.canonical);
  const base = url ? url.replace(/\/$/, '') : '';
  const id = (frag: string) => (base ? `${base}#${frag}` : undefined);

  const graph: Json[] = [];

  // ── The business itself ────────────────────────────────────────────────
  // seo.businessType lets a client be a Plumber/HVACBusiness/RoofingContractor rather than
  // a generic LocalBusiness — a meaningfully stronger entity signal. Added in schema v1.5.0;
  // absent today, in which case LocalBusiness is the correct fallback.
  const businessType = str(seo.businessType) || 'LocalBusiness';
  const address = str(brand.address);
  const review = obj(ext.reviewBadge);
  const hours = obj(ext.hours);
  const serviceArea = arr(ext.serviceArea).map(str).filter(Boolean);

  const business = compact({
    '@type': businessType,
    '@id': id('business'),
    name,
    description: str(seo.description) || str(brand.tagline),
    telephone: str(brand.phone),
    email: str(brand.email),
    url: url || undefined,
    foundingDate: str(brand.established) || undefined,
    priceRange: str(seo.priceRange) || undefined,
    address: address ? postalAddress(address) : undefined,
    areaServed: serviceArea.map((a) => ({ '@type': 'Place', name: a })),
    sameAs: arr(seo.sameAs).map(str).filter(Boolean),
    openingHoursSpecification: openingHours(hours),
    aggregateRating:
      Number(review.rating) > 0 && Number(review.count) > 0
        ? compact({
            '@type': 'AggregateRating',
            ratingValue: String(review.rating),
            reviewCount: String(review.count),
            url: str(review.url) || undefined,
          })
        : undefined,
  });

  // geo is a nested pair — only emit when both halves are real numbers.
  const geo = obj(seo.geo);
  if (Number.isFinite(Number(geo.lat)) && Number.isFinite(Number(geo.lng)) && (geo.lat || geo.lng)) {
    business.geo = { '@type': 'GeoCoordinates', latitude: Number(geo.lat), longitude: Number(geo.lng) };
  }
  graph.push(business);

  // ── FAQPage — the richest signal for AI answer engines, and previously unexploited ──
  const faqItems = arr(obj(c.faq).items)
    .map(obj)
    .filter((it) => str(it.q) && str(it.a));
  if (faqItems.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': id('faq'),
      mainEntity: faqItems.map((it) => ({
        '@type': 'Question',
        name: str(it.q),
        acceptedAnswer: { '@type': 'Answer', text: str(it.a) },
      })),
    });
  }

  // ── Services ───────────────────────────────────────────────────────────
  const serviceItems = arr(obj(c.services).items).map(obj).filter((it) => str(it.t));
  for (const it of serviceItems) {
    graph.push(compact({
      '@type': 'Service',
      name: str(it.t),
      description: str(it.d),
      provider: id('business') ? { '@id': id('business') } : { '@type': businessType, name },
      areaServed: serviceArea.map((a) => ({ '@type': 'Place', name: a })),
    }));
  }

  // ── Reviews ────────────────────────────────────────────────────────────
  const testimonials = arr(obj(c.testimonials).items)
    .map(obj)
    .filter((it) => str(it.q) && str(it.a));
  for (const t of testimonials) {
    const stars = Number(t.stars);
    graph.push(compact({
      '@type': 'Review',
      itemReviewed: id('business') ? { '@id': id('business') } : { '@type': businessType, name },
      reviewBody: str(t.q),
      author: { '@type': 'Person', name: str(t.a) },
      reviewRating:
        stars > 0
          ? { '@type': 'Rating', ratingValue: String(stars), bestRating: '5' }
          : undefined,
    }));
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
