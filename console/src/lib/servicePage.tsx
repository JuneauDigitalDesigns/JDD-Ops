// The pieces every trade's service page shares (service page upgrade, approved by Xander
// 2026-11-11, mockup "HVAC Service Page Upgrade"). Each trade draws them in its own look; what is
// shown, and when, is decided here once, so no trade can show a fact the client never gave.
//
// Approved word for word on 2026-11-11: "Our work", "About {service}", "Know before you book",
// "How long it takes". With "Starting at", "Areas we serve", "Brands we work with" and
// "Ask for a quote" from 2026-11-10.
//
// BYTE-IDENTICAL in console/src/lib and template/src/lib (console/test/service-page-upgrade.test.mjs).
import type { MouseEvent } from 'react';
import { serviceList, type ServiceRef } from '@/lib/serviceLinks';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const SERVICE_UPGRADE_WORDS = {
  ourWork: 'Our work',
  about: 'About',
  facts: 'Know before you book',
  howLong: 'How long it takes',
  // Approved 2026-11-10; they moved from the body to the header with the price (2026-11-11).
  startingAt: 'Starting at',
  askForQuote: 'Ask for a quote',
} as const;

/** The generated copy on `services.items[i].page`, each piece with its edit path. */
function pageCopy(s: ServiceRef) {
  return obj(s.item.page);
}

/** "About {service}" paragraphs (generated, `page.body`), non-blank, with original indexes. */
export function aboutParagraphs(s: ServiceRef): { text: string; path: string }[] {
  return arr(pageCopy(s).body)
    .map((v, i) => ({ text: str(v), path: `services.items.${s.index}.page.body.${i}` }))
    .filter((x) => x.text);
}

/**
 * One list (what's included, signs it's time to call) with the generated line under each item.
 * The line belongs to the item at the same ORIGINAL index (`page.includedNotes[i]` for
 * `included[i]`); an item the generator couldn't explain has no line and shows alone.
 */
export function listWithNotes(s: ServiceRef, key: 'included' | 'typicalJobs'): { text: string; path: string; note: string; notePath: string }[] {
  const noteKey = key === 'included' ? 'includedNotes' : 'signNotes';
  const notes = arr(pageCopy(s)[noteKey]);
  return serviceList(s, key).map((x) => ({
    text: x.text,
    path: `services.items.${s.index}.${key}.${x.i}`,
    note: str(notes[x.i]),
    notePath: `services.items.${s.index}.page.${noteKey}.${x.i}`,
  }));
}

/**
 * The client's own photos for this service ("Our work"): the job photos tagged to it, up to `max`.
 * Never the service's main image on its own: in the Studio that can be stock filling an empty slot,
 * and stock under "Our work" would claim someone else's job. (Onboarding files photo 1 as a tagged
 * job photo too, so the client's main photo is here when it is theirs.)
 */
export function ourWorkPhotos(content: unknown, s: ServiceRef, max = 3): { url: string; alt: string; path: string }[] {
  const seen = new Set<string>();
  return arr(obj(obj(content).work).projects)
    .map((raw, i) => ({ x: obj(raw), i }))
    .filter(({ x }) => str(x.service) === s.slug && str(obj(x.image).url))
    .map(({ x, i }) => ({ url: str(obj(x.image).url), alt: str(obj(x.image).alt) || str(x.t) || s.t, path: `work.projects.${i}` }))
    .filter((p) => !seen.has(p.url) && Boolean(seen.add(p.url)))
    .slice(0, max);
}

/** The service's brands, else the brands the client listed for the whole business (finding F-D7). */
export function serviceBrands(content: unknown, s: ServiceRef): { text: string; path: string }[] {
  const own = serviceList(s, 'brands').map((x) => ({ text: x.text, path: `services.items.${s.index}.brands.${x.i}` }));
  if (own.length) return own;
  const site = obj(obj(content).extensions).brandsCarried;
  const list = typeof site === 'string' ? site.split(/[,;\n]/) : arr(site);
  return list
    .map((v, i) => ({ text: str(v), path: typeof site === 'string' ? 'extensions.brandsCarried' : `extensions.brandsCarried.${i}` }))
    .filter((x) => x.text);
}

export type ServiceFact = { label: string; values: { text: string; path: string }[] };

/**
 * "Know before you book": only the rows the client gave. An empty list means no box at all.
 * The price is not here: it sits in the page header (Xander 2026-11-11, "upfront pricing").
 */
export function serviceFacts(content: unknown, s: ServiceRef, labels: { howLong: string; areas: string; brands: string }): ServiceFact[] {
  const rows: ServiceFact[] = [];
  const howLong = str(s.item.duration);
  if (howLong) rows.push({ label: labels.howLong, values: [{ text: howLong, path: `services.items.${s.index}.duration` }] });
  const areas = serviceList(s, 'areas').map((x) => ({ text: x.text, path: `services.items.${s.index}.areas.${x.i}` }));
  if (areas.length) rows.push({ label: labels.areas, values: areas });
  const brands = serviceBrands(content, s);
  if (brands.length) rows.push({ label: labels.brands, values: brands });
  return rows;
}

/** The starting price the client gave for this service, or ''. */
export const servicePrice = (s: ServiceRef): string => str(s.item.priceFrom);

/**
 * "Ask for a quote": scrolls to the page's one form (the closing call to action, `#cta`, whose
 * message already names the service) and puts the cursor in its first field. A plain `#cta` link
 * underneath, so it still works with no script; smooth only when motion is welcome.
 */
export function goToQuoteForm(e: MouseEvent<HTMLAnchorElement>) {
  const form = typeof document !== 'undefined' ? document.getElementById('cta') : null;
  if (!form) return;
  e.preventDefault();
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  form.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  const field = form.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select');
  // Focus after the scroll has started, without a second jump.
  window.setTimeout(() => field?.focus({ preventScroll: true }), still ? 0 : 450);
}
