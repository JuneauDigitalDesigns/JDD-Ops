// A client who gave no email, no SEO copy and no legal line never ships the preset's (2026-11-11).
//
// What shipped: the Studio's effective content is `preset <- imported <- generated <- edits`, and
// the merge reads null as "missing". Tracewell Heating & Air (finding 6 of the 2026-11-11
// onboarding test) gave no tagline, no legal line and no SEO copy, so the HVAC preset filled all
// three: "Comfort in every season.", "© 2026 Your HVAC Company LLC. All rights reserved." and
// "Your HVAC Company | Heating & Cooling Service" with the preset's "Licensed HVAC contractor ...
// 24/7 emergency service" description. Copy generation then spread the base's footer into
// `generated` (its .draft.json has `generated.footer.legal` set to the HVAC preset's), so the sample
// outlived the run. A client with `brand.email: null` got `owner@yourhvaccompany.com` in every
// contact block and footer, in the JSON-LD business node seo-pages.ts carries, and in llms.txt.
// #78 found the email and SEO fall-through while fixing the canonical (seo-canonical-no-preset).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { presetFor, VERTICALS } from '../src/lib/verticals.ts';
import { deepMerge } from '@jdd/ui/merge';
import { effectiveContent } from '../src/lib/effectiveContent.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';
import { buildPageSeo, businessNode, seoPagesSource } from '../src/lib/pageSeo.ts';
import {
  stripPresetIdentity,
  isSampleIdentity,
  carriesSampleIdentity,
  IDENTITY_FIELDS,
} from '../src/lib/presetIdentity.ts';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const src = (rel) => read(`../src/${rel}`);
const get = (o, path) => path.split('.').reduce((c, k) => (c == null ? undefined : c[k]), o);

// Tracewell's intake as clients/tracewell-heating-air/site.ts has it, with `brand.email` null the
// way a client who skipped the email question sends it.
const TRACEWELL = {
  brand: {
    name: 'Tracewell Heating & Air',
    short: 'Tracewell Heating & Air',
    long: 'Tracewell Heating & Air',
    established: '2011',
    tagline: null,
    phone: '4075550177',
    phoneHref: 'tel:4075550177',
    email: null,
    address: '1200 Tracer Ridge Rd, Winter Park, FL 32789',
    license: 'CAC1800177',
  },
  footer: { social: [], legalLinks: [], legal: null },
  seo: { title: null, description: null, canonical: null, googleAnalyticsId: null, facebookPixelId: null },
  extensions: {
    trustBadges: ['TW Test Award 2025'],
    contactDetails: { address: '1200 Tracer Ridge Rd, Winter Park, FL 32789', mapsUrl: null },
    serviceArea: ['Winter Park', 'Maitland', 'Oviedo'],
    hours: { all: 'Mon to Fri, 8am to 5pm' },
  },
};
// The same client before anything was given beyond a name, a phone and a town: what a form with
// the optional questions skipped sends (no badges, no address, no license).
const BARE = {
  brand: { name: 'Tracewell Heating & Air', short: null, long: null, tagline: null, phone: '4075550177', phoneHref: 'tel:4075550177', email: null, address: null, license: null },
  footer: { legal: null },
  seo: { title: null, description: null, canonical: null },
  extensions: { trustBadges: [], contactDetails: { address: null, mapsUrl: null }, serviceArea: ['Winter Park'] },
};

const HVAC = presetFor('hvac');
// The HVAC preset's own identity values, read from the preset rather than from the list under
// test, so an incomplete list can't make this pass.
const PRESET_VALUES = [
  ...IDENTITY_FIELDS.map((f) => get(HVAC, f.path)),
  HVAC.footer.legal,
  HVAC.extensions.trustBadges?.[0],
  'Your HVAC Company',
  'yourhvaccompany.com',
  '555-0100',
  '5555550100',
  'CAC1234567',
].filter((v) => typeof v === 'string' && v.trim());
const leaksIn = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return PRESET_VALUES.filter((v) => text.includes(v));
};

const PAGES = [
  { route: '', pageType: 'home', label: 'Home', sections: [{ categoryId: 'hero' }, { categoryId: 'faq' }] },
  { route: 'about', pageType: 'about', label: 'About', sections: [{ categoryId: 'about' }] },
  { route: 'contact', pageType: 'contact', label: 'Contact', sections: [{ categoryId: 'contact' }] },
];

/** The template's /llms.txt route run on `content`: its real source, with the site.ts import
 *  replaced by `content`. */
async function llmsTxt(content) {
  const route = read('../../template/src/app/llms.txt/route.ts');
  const importLine = "import { CONTENT } from '@/data/site';";
  assert.ok(route.includes(importLine), 'llms.txt no longer reads CONTENT from site.ts; update this test');
  const js = ts.transpileModule(route.replace(importLine, 'const CONTENT = globalThis.__llmsContent;'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  globalThis.__llmsContent = content;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Math.random()}`);
  return mod.GET().text();
}

test("the Studio's effective content gives a client with no email, SEO copy, tagline or legal line none of the preset's", () => {
  for (const imported of [TRACEWELL, BARE]) {
    const out = effectiveContent('hvac', imported, null, {});
    assert.equal(out.brand.email, '', 'the preset email filled a client with none');
    assert.equal(out.seo.title, '');
    assert.equal(out.seo.description, '');
    assert.equal(out.brand.tagline, '');
    assert.equal(out.footer.legal, '');
    assert.deepEqual(leaksIn(out.brand), [], 'brand carries a preset identity value');
    assert.deepEqual(leaksIn({ seo: out.seo, footer: out.footer, hero: out.hero.secondaryCta, cta: out.finalCta.secondary }), []);
    assert.deepEqual(leaksIn(out.extensions.trustBadges ?? []), []);
    assert.deepEqual(leaksIn(out.extensions.contactDetails ?? {}), []);
  }
  // A phone with no tel: link: the call buttons dial the client, not the preset's number.
  const noHref = effectiveContent('hvac', { ...BARE, brand: { ...BARE.brand, phoneHref: null } }, null, {});
  assert.equal(noHref.brand.phoneHref, 'tel:4075550177');
});

test("the client's own identity survives every layer, 555-01xx phone included", () => {
  const out = effectiveContent('hvac', { ...TRACEWELL, brand: { ...TRACEWELL.brand, email: 'xanderjuneau+jddtest-e2e1@gmail.com', tagline: 'We will Trace down those issues!' } }, null, {});
  assert.equal(out.brand.email, 'xanderjuneau+jddtest-e2e1@gmail.com');
  assert.equal(out.brand.tagline, 'We will Trace down those issues!');
  assert.equal(out.brand.phone, '4075550177');
  assert.equal(out.brand.license, 'CAC1800177');
  assert.equal(out.brand.address, TRACEWELL.brand.address);
  assert.deepEqual(out.extensions.trustBadges, ['TW Test Award 2025']);
  // Nothing to strip: the same object back, so the Studio's memo doesn't churn.
  const clean = { brand: { email: 'tess@tracewellair.com', phone: '(407) 555-0177' }, footer: { legal: '© 2026 Tracewell Heating & Air LLC. All rights reserved.' } };
  assert.equal(stripPresetIdentity(clean).content, clean);
});

test('a sample already baked into generated copy is dropped, and the generated copy is kept', () => {
  // What the Studio sent as `base` before this fix: the merged content, preset identity and all.
  // applyGeneratedCopy spreads base.brand and base.footer into generated.
  const base = deepMerge(HVAC, TRACEWELL);
  const copy = {
    brand: { tagline: 'Heating and cooling for Winter Park homes.' },
    footer: { blurb: 'Tracewell Heating & Air keeps Winter Park comfortable.' },
    seo: { title: 'Heating & Air in Winter Park | Tracewell Heating & Air', description: 'AC installation and service across Winter Park and nearby areas.' },
  };
  const generated = applyGeneratedCopy(base, copy, new Set(['brand', 'footer', 'seo']));
  assert.equal(generated.footer.legal, HVAC.footer.legal, 'precondition: the run carries the preset legal line up');
  assert.equal(generated.brand.email, HVAC.brand.email, 'precondition: the run carries the preset email up');
  const out = effectiveContent('hvac', TRACEWELL, generated, {});
  assert.equal(out.brand.email, '');
  assert.equal(out.footer.legal, '');
  assert.deepEqual(leaksIn({ brand: out.brand, footer: out.footer, seo: out.seo }), []);
  assert.equal(out.brand.tagline, copy.brand.tagline);
  assert.equal(out.seo.title, copy.seo.title);
  assert.equal(out.footer.blurb, copy.footer.blurb);
});

test('what the export writes names no preset identity: site content, seo-pages.ts, the JSON-LD and llms.txt', async () => {
  // What the export is handed: the Studio's effective content, or (a direct API call, which skips
  // the Studio) the raw merge, which only the export's own gate cleans.
  const handed = [TRACEWELL, BARE].flatMap((imported) => [
    effectiveContent('hvac', imported, null, {}),
    stripPresetIdentity(deepMerge(HVAC, imported)).content,
  ]);
  for (const shipped of handed) {
    assert.deepEqual(leaksIn({ brand: shipped.brand, seo: shipped.seo, footer: shipped.footer }), [], 'site.ts');

    const pages = buildPageSeo(shipped, PAGES, 'hvac');
    const business = businessNode(shipped, 'hvac');
    assert.equal(business.email, undefined, 'the business node names an email the client never gave');
    assert.equal(business.description, undefined, 'the business node carries the preset description');
    assert.deepEqual(leaksIn(seoPagesSource(pages, business)), [], 'src/data/seo-pages.ts');
    // The home title is the approved D7 pattern from the client's own name, trade and town.
    assert.equal(pages[''].title, 'HVAC in Winter Park | Tracewell Heating & Air');
    assert.equal(pages[''].description, '');

    const llms = await llmsTxt(shipped);
    assert.deepEqual(leaksIn(llms), [], 'llms.txt');
    assert.ok(!/^Email:/m.test(llms), 'llms.txt lists an email for a client with none');
    assert.ok(llms.startsWith('# Tracewell Heating & Air'));
  }
});

test('the export strips sample identity on every branch, before site.ts is written', () => {
  const s = src('app/api/build/export/route.ts');
  const shipped = s.match(/const shipped = .*;/g) ?? [];
  assert.equal(shipped.length, 3);
  for (const line of shipped) assert.match(line, /withoutPresetIdentity\(preserveProvisioned\(/, `a branch builds site.ts without the identity gate: ${line}`);
  assert.match(s, /stripPresetIdentity\(c\)/);
  assert.match(src('lib/effectiveContent.ts'), /stripPresetIdentity\(/);
});

test("every preset's, the seed's and the template's identity samples are on the list", () => {
  for (const v of VERTICALS) {
    const preset = presetFor(v.id);
    for (const { path } of IDENTITY_FIELDS) {
      const value = get(preset, path);
      if (typeof value === 'string' && value.trim()) assert.ok(isSampleIdentity(path, value), `${v.id} ${path} "${value}" is not on the list`);
    }
    for (const path of ['footer.legal', 'hero.secondaryCta', 'finalCta.secondary']) {
      const value = get(preset, path);
      if (typeof value === 'string' && /\d{3}.?\d{4}|LLC|@/.test(value)) assert.ok(carriesSampleIdentity(value), `${v.id} ${path} "${value}" is not caught`);
    }
    const stripped = stripPresetIdentity(preset).content;
    for (const { path } of IDENTITY_FIELDS) assert.ok(!get(stripped, path), `${v.id} ${path} survives the strip`);
  }
  // Read as source: importing data/site.ts under tsx trips @jdd/schema's package exports.
  for (const rel of ['../src/data/site.ts', '../../template/src/data/site.ts']) {
    const file = read(rel);
    for (const key of ['long', 'tagline', 'phone', 'phoneHref', 'email', 'address']) {
      const m = new RegExp(`\\n\\s+${key}:\\s+"([^"]+)"`).exec(file);
      assert.ok(m, `${rel} has no brand.${key}`);
      assert.ok(isSampleIdentity(`brand.${key}`, m[1]), `${rel} brand.${key} "${m[1]}" is not on the list`);
    }
  }
});

test('a contact block or footer with no email renders no mailto link', () => {
  const dirs = ['components/catalog/contact', 'components/catalog/footer'];
  let seen = 0;
  for (const dir of dirs) {
    for (const f of readdirSync(fileURLToPath(new URL(`../src/${dir}`, import.meta.url)))) {
      if (!f.endsWith('.tsx')) continue;
      const s = src(`${dir}/${f}`);
      for (const m of s.matchAll(/href=\{`mailto:\$\{brand\.email\}`\}/g)) {
        seen++;
        const before = s.slice(Math.max(0, m.index - 160), m.index);
        assert.match(before, /\{brand\.email && \(\s*<a\s*$/, `${dir}/${f} links mailto: with no email check`);
      }
    }
  }
  assert.ok(seen >= 14, `expected the 14 mailto links, saw ${seen}`);
  const page = read('../../template/src/app/page.tsx');
  if (page.includes('mailto:${CONTENT.brand.email}')) assert.match(page, /CONTENT\.brand\.email && /);
});
