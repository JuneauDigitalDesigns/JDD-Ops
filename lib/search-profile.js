/**
 * lib/search-profile.js — what the agency's nightly Search Console job needs to know about one
 * site, published by the console to KV (L11/L12, Phase 2 and 3).
 *
 * The agency holds no durable copy of a client's towns or services: the town list lives in the
 * site content the console holds (the intake item that carried it expires after 30 days). So the
 * console publishes this small profile when it verifies a property, and refreshes it on every
 * export, and the nightly job reads it to sort Search Console queries into service × town.
 *
 * Everything is derived from the exported SiteContent through @jdd/schema's own gates, so the job
 * never re-implements which town earns a page (L6), the main city (L4), or the caps (L14).
 *
 * Key: `jdd:seo:profile:v1:{acctScope}:{siteSlug}`. Scoped by account because slugs are unique
 * only within an account, and the profile carries client-derived data (towns, service names).
 * Bump v1 when the shape changes; the agency reads exactly this version.
 */

import {
  primaryCity, serviceSlugs, qualifiesForServicePage, pickAreaPages, qualifiesForAreaPage,
  areaPageFacts, spokePageFacts, townSlugs, canonicalTown, PAGE_CAPS,
} from '@jdd/schema';

export const SEARCH_PROFILE_VERSION = 1;

export const searchProfileKey = (acctScope, siteSlug) => `jdd:seo:profile:v1:${acctScope}:${siteSlug}`;

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** Lowercase, accents folded, punctuation to spaces, single-spaced. The job normalizes queries the same way. */
export function normalizeTerm(s) {
  return str(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The phrases a query can use to mean this service: its name (without "near me"), its slug's
 * words, and each typical job in the customer's own words. Normalized, de-duplicated, and never
 * a single stop word.
 */
export function serviceTerms(item, slug) {
  const STOP = new Set(['and', 'the', 'a', 'of', 'for', 'in', 'service', 'services']);
  const out = new Set();
  const add = (s) => {
    const t = normalizeTerm(s).replace(/\bnear me\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (t && !STOP.has(t)) out.add(t);
  };
  add(item.t);
  add(slug.replace(/-/g, ' '));
  for (const j of arr(item.typicalJobs)) add(j);
  return [...out];
}

/**
 * Build the profile from exported content. `previous` is the profile already in KV: its property,
 * verification time and each spoke's `since` survive, so a re-export never resets the fold clock.
 */
export function buildSearchProfile(content, { siteSlug, property, verifiedAt, previous = null, now = new Date() }) {
  const c = obj(content);
  const area = arr(obj(c.extensions).serviceArea).map(str).filter(Boolean);
  const slugs = townSlugs(content);
  const hubs = new Set(pickAreaPages(content));
  const svcSlugs = serviceSlugs(content);
  const items = arr(obj(c.services).items).map(obj);

  const towns = area.map((name, i) => ({
    name,
    slug: slugs[i],
    hub: hubs.has(name),
    qualifies: qualifiesForAreaPage(content, name),
    facts: areaPageFacts(content, name).count,
  }));

  const services = items.map((item, i) => ({
    slug: svcSlugs[i],
    name: str(item.t),
    terms: serviceTerms(item, svcSlugs[i]),
    page: qualifiesForServicePage(content, i),
  }));

  // Facts tagged to both a town and a service, only where there are any (L6: a spoke needs 2).
  const sharedFacts = {};
  for (const t of area) {
    svcSlugs.forEach((s, i) => {
      const n = spokePageFacts(content, t, i).count;
      if (n > 0) sharedFacts[`${t}|${s}`] = n;
    });
  }

  const prevSince = new Map(arr(previous?.spokes).map((s) => [`${s.town}|${s.service}`, s.since]));
  const spokes = [];
  for (const ref of arr(c.areaPages).map(obj)) {
    const town = canonicalTown(content, ref.town);
    for (const service of arr(ref.spokes).map(str).filter(Boolean)) {
      const key = `${town}|${service}`;
      spokes.push({ town, service, since: prevSince.get(key) ?? now.toISOString() });
    }
  }

  return {
    v: SEARCH_PROFILE_VERSION,
    siteSlug,
    property: property ?? previous?.property ?? null,
    verifiedAt: verifiedAt ?? previous?.verifiedAt ?? null,
    mainCity: primaryCity(content),
    caps: { area: PAGE_CAPS.area, spoke: PAGE_CAPS.spoke },
    towns,
    services,
    sharedFacts,
    spokes,
    updatedAt: now.toISOString(),
  };
}
