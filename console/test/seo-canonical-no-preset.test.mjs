// A client with no website never gets the industry preset's canonical (2026-11-11).
//
// What shipped: a self-serve HVAC client (Tracewell Heating & Air) skipped the website question,
// so its intake had `seo.canonical: null`. The Studio's effective content is
// `preset <- imported <- generated <- edits`, the merge reads null as "missing", and the HVAC
// preset's https://yourhvaccompany.com filled the gap. Copy generation then spread that seo into
// `generated` (its .draft.json has `generated.seo.canonical: "https://yourhvaccompany.com"`), and
// an export would have put somebody else's domain in every page's canonical tag, the sitemap,
// robots.txt and the JSON-LD. The second half: once the client is onboarded, /manage reports an
// empty or wrong canonical against the domains Vercel serves (lib/canonicalCheck.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { vercelAppHost } from '@jdd/schema';
import { presetFor, VERTICALS } from '../src/lib/verticals.ts';
import { effectiveContent } from '../src/lib/effectiveContent.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';
import {
  RETIRED_PLACEHOLDER_CANONICALS,
  isPlaceholderCanonical,
  normalizeCanonical,
  stripPlaceholderCanonical,
  applyIntakeCanonical,
  withoutCarriedCanonical,
} from '../src/lib/placeholderCanonical.ts';
import { buildPageSeo, businessNode, seoPagesSource } from '../src/lib/pageSeo.ts';
import { checkCanonical } from '../src/lib/canonicalCheck.ts';

const src = (rel) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

// Verbatim from the Tracewell evidence (clients/tracewell-heating-air/.draft.json): the intake's
// seo block, and the seo the copy run wrote into `generated`.
const TRACEWELL_IMPORTED_SEO = { title: null, description: null, canonical: null, googleAnalyticsId: null, facebookPixelId: null };
const TRACEWELL_GENERATED_SEO = {
  title: 'Heating & Air in Winter Park | Tracewell Heating & Air',
  description: 'AC installation and service, furnace repair and replacement and attic fan checks across Winter Park and nearby areas. Emergency help day or night, so call now.',
  canonical: 'https://yourhvaccompany.com',
  googleAnalyticsId: null,
  facebookPixelId: null,
};

const imported = (seo) => ({ ...presetFor('hvac'), brand: { ...presetFor('hvac').brand, name: 'Tracewell Heating & Air' }, seo });
// A URL on a placeholder host. (Not the bare host: the preset's brand.email is owner@yourhvaccompany.com,
// a separate fall-through this file doesn't cover.)
const leaks = (value) => /:\/\/(www\.)?(your[a-z]*\.com|peakhomeservices\.com|example\.com)/i.test(typeof value === 'string' ? value : JSON.stringify(value));

test('no industry preset and no default seed carries a canonical', () => {
  for (const v of VERTICALS) {
    assert.equal(presetFor(v.id).seo.canonical, '', `${v.id} preset still ships a sample canonical`);
  }
  // Read as source: importing data/site.ts under tsx trips @jdd/schema's package exports.
  const seed = src('data/site.ts');
  assert.ok(!/canonical:\s*"https?:\/\//.test(seed), 'the default seed still ships a sample canonical');
});

test("the Studio's effective content leaves a client with no website without a canonical", () => {
  const out = effectiveContent('hvac', imported(TRACEWELL_IMPORTED_SEO), null, {});
  assert.equal(out.seo.canonical, '');
});

test("a placeholder already baked into a draft's generated copy is dropped, not shipped", () => {
  const out = effectiveContent('hvac', imported(TRACEWELL_IMPORTED_SEO), { seo: TRACEWELL_GENERATED_SEO }, {});
  assert.equal(out.seo.canonical, '');
  assert.equal(out.seo.title, TRACEWELL_GENERATED_SEO.title, 'the generated title is kept');
});

test("the client's own canonical survives every layer", () => {
  const out = effectiveContent('hvac', imported({ ...TRACEWELL_IMPORTED_SEO, canonical: 'https://tracewellair.com' }), { seo: { ...TRACEWELL_GENERATED_SEO, canonical: '' } }, {});
  assert.equal(out.seo.canonical, 'https://tracewellair.com');
});

test('copy generation carries no canonical into generated', () => {
  // The base the Studio posts is its effective content; the bug was a base holding the preset URL.
  const base = { ...presetFor('hvac'), seo: { ...presetFor('hvac').seo, canonical: 'https://yourhvaccompany.com' } };
  const copy = { seo: { title: TRACEWELL_GENERATED_SEO.title, description: TRACEWELL_GENERATED_SEO.description } };
  const generated = withoutCarriedCanonical(applyGeneratedCopy(base, copy, new Set(['brand', 'seo'])));
  assert.equal(generated.seo.canonical, '');
  assert.equal(generated.seo.title, TRACEWELL_GENERATED_SEO.title);
  // A real canonical in the base isn't copied up either: generated sits above imported, so a
  // carried value would shadow the client's own one if that changed later.
  const real = withoutCarriedCanonical(applyGeneratedCopy({ ...base, seo: { ...base.seo, canonical: 'https://tracewellair.com' } }, copy, new Set(['brand', 'seo'])));
  assert.equal(real.seo.canonical, '');
  assert.match(src('app/api/build/generate-copy/route.ts'), /withoutCarriedCanonical\(applyGeneratedCopy\(/, 'the route sends generated copy without the strip');
});

test('export output for a client with no website names no placeholder anywhere', () => {
  const content = effectiveContent('hvac', imported(TRACEWELL_IMPORTED_SEO), { seo: TRACEWELL_GENERATED_SEO }, {});
  const pages = [
    { route: '', pageType: 'home', label: 'Home', sections: [{ categoryId: 'hero' }] },
    { route: 'about', pageType: 'about', label: 'About', sections: [{ categoryId: 'about' }] },
  ];
  const seo = buildPageSeo(content, pages, 'hvac');
  for (const [route, p] of Object.entries(seo)) assert.equal(p.canonical, '', `/${route} ships a canonical`);
  const business = businessNode(content, 'hvac');
  assert.equal(business.url, undefined);
  assert.ok(!leaks(seoPagesSource(seo, business)), 'src/data/seo-pages.ts would name a placeholder domain');
});

test('the export strips a placeholder canonical on every branch, before site.ts is written', () => {
  const s = src('app/api/build/export/route.ts');
  assert.equal((s.match(/const shipped = withoutSampleReviews\(withRealCanonical\(/g) ?? []).length, 3, 'a branch builds site.ts without the canonical gate');
  assert.match(s, /stripPlaceholderCanonical\(c\)/);
  assert.match(s, /applyIntakeCanonical\(stripped, intakeCanonical\)/);
});

test('stripPlaceholderCanonical removes every retired placeholder and keeps a real domain', () => {
  for (const { url } of RETIRED_PLACEHOLDER_CANONICALS) {
    for (const variant of [url, `${url}/`, url.replace('https://', 'https://www.'), url.replace('https://', '')]) {
      const { content, removed } = stripPlaceholderCanonical({ seo: { canonical: variant } });
      assert.equal(content.seo.canonical, '', `${variant} survived`);
      assert.equal(removed, variant);
    }
  }
  const real = { seo: { canonical: 'https://tracewellair.com' } };
  assert.deepEqual(stripPlaceholderCanonical(real), { content: real, removed: null });
});

test("the canonical /manage set in clients/{slug}/site.ts wins at export; an empty or sample one doesn't", () => {
  const studio = { seo: { canonical: 'https://old.vercel.app' } };
  assert.deepEqual(applyIntakeCanonical(studio, 'https://tracewellair.com/').replaced, { from: 'https://old.vercel.app', to: 'https://tracewellair.com' });
  assert.equal(applyIntakeCanonical(studio, 'https://tracewellair.com').content.seo.canonical, 'https://tracewellair.com');
  for (const none of [null, '', 'https://yourhvaccompany.com', 'not a url']) {
    assert.equal(applyIntakeCanonical(studio, none).content, studio, `${none} replaced the Studio's canonical`);
  }
});

test('the /manage canonical route refuses a sample address', () => {
  assert.equal(normalizeCanonical('https://yourhvaccompany.com'), null);
  assert.equal(normalizeCanonical('tracewellair.com/'), 'https://tracewellair.com');
  assert.match(src('app/api/manage/canonical/route.ts'), /isPlaceholderCanonical\(canonical\)/);
});

// ── The /manage finding ──────────────────────────────────────────────────────
// Domains in the shape lib/vercel-sync.js's mapDomain normalizes Vercel's response to (no
// recorded Vercel domain list exists, and recording one would mean calling Vercel).
const alias = `${vercelAppHost('tracewell-heating-air')}.vercel.app`;
const onlyAlias = { ok: true, domains: [{ name: alias, verified: true, redirect: null }] };
const check = (over) => checkCanonical({ slug: 'tracewell-heating-air', siteSlug: 'tracewell-heating-air', shipped: '', intake: null, domains: onlyAlias, ...over });

test('empty canonical on a provisioned site: a finding with a button that sets the served URL', () => {
  const r = check({});
  assert.equal(r.ok, false);
  assert.equal(r.finding.id, 'seo.canonicalMissing');
  assert.equal(r.finding.severity, 'amber');
  assert.deepEqual(r.finding.fix.body, { slug: 'tracewell-heating-air', site: 'tracewell-heating-air', canonical: `https://${alias}` });
  assert.equal(r.finding.fix.route, '/api/manage/canonical');
  assert.ok(!r.finding.detail.includes('FAIL:'));
});

test('a canonical on a domain Vercel serves: no finding', () => {
  assert.deepEqual(check({ shipped: `https://${alias}` }), { ok: true, finding: null });
  const custom = { ok: true, domains: [...onlyAlias.domains, { name: 'tracewellair.com', verified: true, redirect: null }] };
  assert.deepEqual(check({ shipped: 'https://tracewellair.com/', domains: custom }), { ok: true, finding: null });
});

test('could not check is null, never a pass', () => {
  assert.deepEqual(check({ domains: null }), { ok: null, finding: null });
  assert.deepEqual(check({ domains: { ok: false, domains: [] } }), { ok: null, finding: null });
  // The project exists but serves on nothing: site.noUrl covers it, and there is nothing to compare.
  assert.deepEqual(check({ shipped: 'https://tracewellair.com', domains: { ok: true, domains: [] } }), { ok: null, finding: null });
});

test("the preset placeholder on a live site is a red finding, and so is a host that only redirects", () => {
  const r = check({ shipped: 'https://yourhvaccompany.com' });
  assert.equal(r.finding.id, 'seo.canonicalWrong');
  assert.equal(r.finding.severity, 'red');
  assert.equal(r.finding.title, 'Canonical URL points at yourhvaccompany.com');
  const domains = { ok: true, domains: [
    { name: alias, verified: true, redirect: null },
    { name: 'www.tracewellair.com', verified: true, redirect: null },
    { name: 'tracewellair.com', verified: true, redirect: 'www.tracewellair.com' },
  ] };
  const apex = check({ shipped: 'https://tracewellair.com', domains });
  assert.equal(apex.finding.id, 'seo.canonicalWrong');
  assert.equal(apex.finding.fix.body.canonical, 'https://www.tracewellair.com');
  // Once a custom domain is attached, the vercel.app canonical set before it is stale.
  assert.equal(check({ shipped: `https://${alias}`, domains }).finding.id, 'seo.canonicalWrong');
});

test('set in site.ts but not exported yet: says to deploy, offers no button', () => {
  const r = check({ shipped: 'https://yourhvaccompany.com', intake: `https://${alias}` });
  assert.equal(r.finding.id, 'seo.canonicalNotLive');
  assert.equal(r.finding.fix, undefined);
  // No readable repo copy: what site.ts says is what the check reads.
  assert.deepEqual(check({ shipped: undefined, intake: `https://${alias}` }), { ok: true, finding: null });
  assert.equal(check({ shipped: undefined, intake: null }).finding.id, 'seo.canonicalMissing');
});

test('the sweep runs the check on the domain list it already fetched', () => {
  const s = src('lib/reconcile.ts');
  assert.match(s, /checkCanonical\(\{[\s\S]*?domains,\s*\}\)/);
  const block = s.slice(s.indexOf('if (a.vercel && shouldBeLive)'), s.indexOf("} else if (!a.vercel && shouldBeLive && !quiet)"));
  assert.ok(block.includes('checkCanonical('), 'the check must sit inside the provisioned-and-Vercel block');
});
