/**
 * scorePage: one pure scorer for every page of a client site (SEO plan D13, Xander 2026-11-10).
 *
 * The same function serves the console suite (fixtures), the Studio (findings) and the export,
 * which refuses on any HARD failure before it writes a file: the onboard-checks.js pattern, so a
 * check can never bless what the export would ship differently.
 *
 * HARD (Xander's list: dashes, invented facts, duplicate titles, wrong canonical; plus the spec's
 * "near me" and service-page rules):
 *   - an em- or en-dash in visible copy, a title or a description
 *   - "near me" anywhere visible
 *   - a number in visible copy that is not in the client's facts (invented facts). Unchanged
 *     preset text is exempt: Xander's D2 makes preset copy a warning, never a refusal
 *   - a missing or duplicate page title
 *   - a site canonical that is not an absolute URL
 *   - a service page whose service doesn't earn a page (servicePages.ts), or that shares an
 *     8-word run with another service page (the doorway pattern)
 *
 * SOFT (findings): title 50 to 60 chars, description 140 to 165, no city in the home headline
 * (D8) or a title, FAQ counts, reading level above about grade 8, no profile links, a service
 * page without proof, duplicate descriptions, no canonical at all, and D2's preset copy and
 * unsupported claims.
 */
import { copyRisks, factsText, getPath, visibleCopy } from '@/lib/copyRisks';
import { findDashes } from '@/lib/copy-brief/dash-guard';
import { toE164 } from '@jdd/schema';
import { primaryCity, qualifiesForServicePage, serviceSlugs } from '@/lib/servicePages';
import type { PageSeo, SeoPageRef } from '@/lib/pageSeo';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export interface SiteScore {
  /** Refuse the export when non-empty. Each line names the field or page. */
  hard: string[];
  soft: string[];
  ok: boolean;
}

const DASH = /[–—]/;
const NEAR_ME = /\bnear me\b/i;
/** A number as written in copy: $89, 4.9, 1,200, 100%, 24/7 (two tokens). */
const NUMBER = /\$?\d[\d,]*(?:\.\d+)?%?/g;

const digitsOf = (token: string) => token.replace(/[^\d.]/g, '').replace(/\.$/, '');

/**
 * A phone number as copy writes it: (407) 555-0177, 407-555-0177, 407.555.0177,
 * +1 407 555 0177, 4075550177. Matched as one run BEFORE the copy is split into NUMBER tokens.
 *
 * Why (2026-11-11): factNumbers stores the phone as ONE digits token ("4075550177"), but NUMBER
 * splits "Call 407-555-0177" into "407", "555" and "0177", none of which is that token. So every
 * mention of the client's own number was three blocking "not in the client's facts" findings:
 * Tracewell's SEO check had 9 of them across work.sub, faq.items.2.a and finalCta.secondary.
 */
const PHONE = /(?<![\d+])(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;

/** Every phone the client stated, as E.164: brand.phone, brand.phoneHref, and any phone written
 *  in the facts. SiteContent has no other phone field. */
function factPhones(content: unknown): Set<string> {
  const brand = obj(obj(content).brand);
  const out = new Set<string>();
  const add = (raw: string) => {
    const e164 = toE164(raw.replace(/^tel:/i, ''));
    if (e164) out.add(e164);
  };
  add(str(brand.phone));
  add(str(brand.phoneHref));
  for (const m of factsText(content).matchAll(PHONE)) add(m[0]);
  return out;
}

/** Blank out each run of the client's own phone so its pieces aren't read as numbers. A phone
 *  the client didn't state is left in place, so its pieces are still flagged. */
function maskKnownPhones(text: string, phones: Set<string>): string {
  return text.replace(PHONE, (run) => (phones.has(toE164(run) ?? '') ? ' ' : run));
}

/** The current year in a copyright line ("© 2026 …", "Copyright 2026 …") is not a claim. Only
 *  there: a bare "2026" anywhere else is still checked. */
function maskCopyrightYear(text: string, year: number): string {
  return text.replace(new RegExp(`((?:©|\\bcopyright\\b)\\s*(?:©\\s*)?)${year}(?!\\d)`, 'gi'), '$1');
}

/** Every number the client stated: facts plus contact details (a street number, a ZIP, the
 *  phone) and the service-area towns. */
function factNumbers(content: unknown): Set<string> {
  const c = obj(content);
  const brand = obj(c.brand);
  const text = [factsText(content), str(brand.phone), str(brand.address), str(brand.email)].join('\n');
  const out = new Set<string>();
  for (const m of text.matchAll(NUMBER)) out.add(digitsOf(m[0]));
  // "24/7" stated in hours is two numbers, both stated.
  return out;
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
}

function shingles(text: string, n = 8): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

/** Flesch-Kincaid grade over prose. Approximate (vowel-group syllables), which is enough for a
 *  finding; it is never a hard failure. */
function readingGrade(text: string): number {
  const sentences = Math.max(1, (text.match(/[.!?]+(\s|$)/g) ?? []).length);
  const w = words(text);
  if (w.length < 30) return 0;
  const syllables = w.reduce((n, word) => n + Math.max(1, (word.match(/[aeiouy]+/g) ?? []).length - (word.endsWith('e') ? 1 : 0)), 0);
  return 0.39 * (w.length / sentences) + 11.8 * (syllables / w.length) - 15.59;
}

export function scoreSite(
  content: unknown,
  pages: SeoPageRef[],
  pageSeo: Record<string, PageSeo>,
  opts: { preset?: unknown; now?: Date } = {},
): SiteScore {
  const hard: string[] = [];
  const soft: string[] = [];
  const c = obj(content);
  const copy = visibleCopy(content);
  const preset = opts.preset ?? {};
  const isPreset = (path: string, text: string) => {
    const p = getPath(preset, path);
    return typeof p === 'string' && p.trim() === text.trim();
  };

  // ── Dashes and "near me" (visible copy, titles, descriptions) ──
  const seoStrings: Array<[string, string]> = Object.entries(pageSeo).flatMap(([route, p]) => [
    [`title of /${route}`, p.title] as [string, string],
    [`description of /${route}`, p.description] as [string, string],
  ]);
  for (const [path, text] of [...copy, ...seoStrings]) {
    if (DASH.test(text)) hard.push(`Em-dash or en-dash in ${path}: "${text.slice(0, 80)}"`);
    if (NEAR_ME.test(text)) hard.push(`"near me" in ${path}: "${text.slice(0, 80)}"`);
  }
  // findDashes is the generator's own guard; run it too so the two can never disagree.
  for (const p of findDashes({ seo: { title: str(obj(c.seo).title), description: str(obj(c.seo).description) } })) {
    if (!hard.some((h) => h.includes(p))) hard.push(`Em-dash or en-dash in ${p}`);
  }

  // ── Invented facts: numbers the client never stated ──
  const known = factNumbers(content);
  const phones = factPhones(content);
  const year = (opts.now ?? new Date()).getFullYear();
  for (const [path, text] of copy) {
    if (isPreset(path, text)) continue; // D2: preset copy warns, below
    for (const m of maskCopyrightYear(maskKnownPhones(text, phones), year).matchAll(NUMBER)) {
      const token = m[0];
      const digits = digitsOf(token);
      if (!digits) continue;
      // A lone single digit ("3 steps", "1 call") is prose, not a claim; money and percentages
      // always count.
      if (/^\d$/.test(digits) && !/[$%]/.test(token)) continue;
      if (!known.has(digits)) hard.push(`Number "${token.replace(/[,%$]/g, (x) => (x === ',' ? '' : x))}" in ${path} is not in the client's facts`);
    }
  }

  // ── Titles, descriptions, canonical ──
  const byTitle = new Map<string, string[]>();
  const byDesc = new Map<string, string[]>();
  for (const [route, p] of Object.entries(pageSeo)) {
    if (!p.title) hard.push(`Page /${route} has no title`);
    else byTitle.set(p.title, [...(byTitle.get(p.title) ?? []), `/${route}`]);
    if (p.description) byDesc.set(p.description, [...(byDesc.get(p.description) ?? []), `/${route}`]);
    if (p.title && (p.title.length < 50 || p.title.length > 60)) soft.push(`Title of /${route} is ${p.title.length} characters (aim for 50 to 60): "${p.title}"`);
    if (!p.description) soft.push(`Page /${route} has no description`);
    else if (p.description.length < 140 || p.description.length > 165) soft.push(`Description of /${route} is ${p.description.length} characters (aim for 140 to 165)`);
  }
  for (const [title, routes] of byTitle) if (routes.length > 1) hard.push(`Duplicate title "${title}" on ${routes.join(', ')}`);
  for (const [, routes] of byDesc) if (routes.length > 1) soft.push(`Same description on ${routes.join(', ')}`);

  const canonical = str(obj(c.seo).canonical);
  if (canonical && !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(canonical)) hard.push(`seo.canonical "${canonical}" is not an absolute URL`);
  if (!canonical) soft.push('No canonical URL is set: pages ship without canonicals and the sitemap lists nothing');

  // ── City (D8), profiles, FAQs, reading level ──
  const city = primaryCity(content);
  const headline = str(obj(c.hero).headline);
  if (city && headline && !headline.toLowerCase().includes(city.toLowerCase())) soft.push(`The home headline does not name the city (${city}): "${headline}"`);
  if (!arr(obj(c.extensions).profiles).length) soft.push('No profile links (Google Business Profile, Facebook, Yelp, ...): the footer block and sameAs are empty');
  const homeFaq = arr(obj(c.faq).items).filter((it) => str(obj(it).q)).length;
  if (pages.some((p) => p.route === '' && p.sections.some((s) => s.categoryId === 'faq')) && homeFaq < 6) soft.push(`Home FAQ has ${homeFaq} questions (aim for 6)`);
  const prose = copy.filter(([path]) => /\.(body|sub|d|detail|a|story\.\d+|intro|blurb)$/.test(path) || /story\.\d+$/.test(path)).map(([, t]) => t).join(' ');
  const grade = readingGrade(prose);
  if (grade > 8.5) soft.push(`Reading level is about grade ${grade.toFixed(1)} (aim for about 7)`);

  // ── Service pages ──
  const items = arr(obj(c.services).items).map(obj);
  const slugs = serviceSlugs(content);
  const servicePages = pages.filter((p) => p.pageType === 'service');
  const texts: Array<[string, Set<string>]> = [];
  for (const p of servicePages) {
    const idx = slugs.findIndex((s) => `services/${s}` === p.route);
    if (idx < 0) {
      hard.push(`Service page /${p.route} has no matching service`);
      continue;
    }
    const item = items[idx];
    if (!qualifiesForServicePage(content, idx)) hard.push(`Service page /${p.route} ("${str(item.t)}") does not have enough facts for a page of its own`);
    const page = obj(item.page);
    const faqs = arr(page.faq).map(obj);
    if (faqs.length < 3) soft.push(`Service page /${p.route} has ${faqs.length} questions (aim for 3 to 5)`);
    const tagged = (list: unknown[]) => list.map(obj).some((x) => str(x.service) === slugs[idx]);
    if (!tagged(arr(obj(c.testimonials).items)) && !tagged(arr(obj(c.work).projects))) soft.push(`Service page /${p.route} has no proof (a real review or job photo tagged to it)`);
    const body = [str(page.intro), ...arr(page.expect).map(str), ...faqs.map((f) => `${str(f.q)} ${str(f.a)}`), str(item.detail)].join(' ');
    texts.push([p.route, shingles(body)]);
  }
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const shared = [...texts[i][1]].find((s) => texts[j][1].has(s));
      if (shared) hard.push(`Service page /${texts[i][0]} shares an 8-word run with /${texts[j][0]}: "${shared}"`);
    }
  }

  // ── D2: preset copy and unsupported claims (warn, never refuse) ──
  const risks = copyRisks(content, preset);
  if (risks.presetCopy.length) soft.push(`${risks.presetCopy.length} field(s) still show the industry preset's sample copy: ${risks.presetCopy.slice(0, 5).map((r) => r.path).join(', ')}${risks.presetCopy.length > 5 ? ', ...' : ''}`);
  for (const r of risks.unsupportedClaims) soft.push(`Claim "${r.claim}" in ${r.path} is not in the client's facts`);

  return { hard: [...new Set(hard)], soft: [...new Set(soft)], ok: hard.length === 0 };
}
