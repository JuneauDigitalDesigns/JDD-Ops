// The copywriter never sets business identity, and writes only the fields it wrote (F-E6 of the
// 2026-11-11 front-to-back onboarding test; approved by Xander, 2026-11-11).
//
// What shipped, part 1: the brand output schema offered the model `name`, `short`, `established`,
// `phone`, `email`, `address` and `license`, and applyGeneratedCopy copied each one over the base
// (`phone` rewrote `phoneHref` too). The only guard was a prompt line asking the model to write them
// only when they appear in the facts. A client's site must advertise the JDD Twilio number (CLAUDE.md,
// "The site must advertise the Twilio number"), so a model-written phone would silently replace it.
// #79 did this for `brand.long` (no-generated-legal-name.test.mjs); this does it for the rest.
//
// What shipped, part 2: `generated.brand` was `{ ...base.brand }`, a copy of the whole brand, and the
// Studio's merge is preset <- imported <- generated <- edits. So every brand field was frozen at
// generation time, and a later correction to the intake (clients/{slug}/site.ts) was hidden behind
// the generated layer unless an operator edit sat on top. Tracewell's stored draft shows it: its
// generated.brand carries a palette and typography the intake no longer has, and the model's
// "Tracewell Heating & Air LLC" as brand.long. trust, hero, finalCta, footer and seo did the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCopySchema } from '../src/lib/copy-schema.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';
import { effectiveContent } from '../src/lib/effectiveContent.ts';

const draft = JSON.parse(readFileSync(new URL('./fixtures/copy-brief/tracewell-draft.json', import.meta.url), 'utf8'));
const imported = () => structuredClone(draft.imported);
const get = (o, path) => path.split('.').reduce((c, k) => (c == null ? undefined : c[k]), o);

const IDENTITY = ['name', 'short', 'established', 'phone', 'email', 'address', 'license'];

// What a model could return for the brand section, every identity field different from the intake's.
const hostile = {
  brand: {
    tagline: 'Comfort you can count on in Winter Park.',
    name: 'Tracewell Comfort Co',
    short: 'Tracewell Co',
    established: '1998',
    phone: '(321) 555-0100',
    email: 'hello@tracewellcomfort.example',
    address: '9 Model Way, Orlando, FL 32801',
    license: 'CAC0000001',
  },
};

// The Studio's base for a run is its effective content (BuildWizard posts it as `base`).
const studioBase = (imp) => effectiveContent('hvac', imp, null, {});

test("the model's brand output schema offers no identity field, and still offers the tagline", () => {
  for (const schema of [buildCopySchema([]), buildCopySchema(['brand'], false)]) {
    const b = schema.properties.brand;
    for (const f of [...IDENTITY, 'long', 'phoneHref']) {
      assert.ok(!(f in b.properties), `brand.${f} is still offered to the model`);
      assert.ok(!b.required.includes(f));
    }
    assert.deepEqual(Object.keys(b.properties), ['tagline']);
    assert.deepEqual(b.required, ['tagline']);
  }
});

test("model output naming another business leaves every intake identity value in place", () => {
  const imp = imported();
  const before = studioBase(imp);
  const generated = applyGeneratedCopy(before, hostile, new Set(['brand']));
  for (const f of [...IDENTITY, 'long', 'phoneHref']) {
    assert.ok(!(f in (generated.brand ?? {})), `generated.brand.${f} was written`);
  }
  const after = effectiveContent('hvac', imp, generated, {});
  for (const f of [...IDENTITY, 'long', 'phoneHref']) {
    assert.deepEqual(after.brand[f], before.brand[f], `brand.${f} changed after generation`);
  }
  assert.equal(after.brand.phone.replace(/\D/g, '').replace(/^1/, ''), '4075550177', "the client's phone");
  // The tagline is copy, and still lands.
  assert.equal(after.brand.tagline, hostile.brand.tagline);
});

test('a correction to the intake after generation shows through the generated layer', () => {
  // The intake at generation time, with a value in every field the correction below changes, so a
  // copied-up value is a real one the merge would keep (a null copied up falls through anyway).
  const setPath = (o, path, value) => {
    const segs = path.split('.');
    segs.slice(0, -1).reduce((c, k) => c[k], o)[segs.at(-1)] = value;
  };
  const imp = imported();
  for (const [path, value] of Object.entries({
    'trust.logos': ['Old Affiliation'],
    'hero.placeholder': 'Your address',
    'finalCta.frictionReducers': ['Old promise one', 'Old promise two', 'Old promise three'],
    'seo.googleAnalyticsId': 'G-OLD0000001',
  })) setPath(imp, path, value);
  const copy = {
    brand: { tagline: 'Comfort you can count on in Winter Park.' },
    trust: { label: 'Trusted across Winter Park' },
    hero: { eyebrow: 'Winter Park HVAC', headline: 'Heating and cooling done right in Winter Park', sub: 'AC and furnace service across Winter Park.', cta: 'Book a visit' },
    finalCta: { eyebrow: 'Ready?', headline: 'Get comfortable again', sub: 'Book a visit today.', cta: 'Book a visit' },
    footer: { blurb: 'Tracewell Heating & Air keeps Winter Park comfortable.' },
    seo: { title: 'HVAC in Winter Park | Tracewell Heating & Air', description: 'AC and furnace service across Winter Park, Maitland and Oviedo.' },
  };
  const generated = applyGeneratedCopy(studioBase(imp), copy, new Set(Object.keys(copy)));

  // The intake, corrected after the run: fields the copywriter never wrote.
  const corrected = structuredClone(imp);
  const fixes = {
    'brand.address': '1250 Tracer Ridge Rd, Winter Park, FL 32789',
    'brand.phone': '4075550188',
    'brand.email': 'office@tracewellair.example',
    'trust.logos': ['NATE Certified'],
    'hero.placeholder': 'Your street address',
    'finalCta.frictionReducers': ['Upfront pricing', 'Same-week visits', 'Licensed techs'],
    'footer.cols.0.links.2.label': 'Attic Fan Check',
    'seo.googleAnalyticsId': 'G-TRACEWELL1',
  };
  for (const [path, value] of Object.entries(fixes)) setPath(corrected, path, value);
  const out = effectiveContent('hvac', corrected, generated, {});
  for (const [path, value] of Object.entries(fixes)) {
    const shown = path === 'brand.phone' ? get(out, path).replace(/\D/g, '').replace(/^1/, '') : get(out, path);
    assert.deepEqual(shown, value, `${path} shows the generation-time value, not the corrected intake`);
  }
  // The copy the run wrote still lands.
  assert.equal(out.brand.tagline, copy.brand.tagline);
  assert.equal(out.hero.headline, copy.hero.headline);
  assert.equal(out.footer.blurb, copy.footer.blurb);
  assert.equal(out.seo.title, copy.seo.title);
});

test("a draft generated before this fix no longer hides the intake's identity", () => {
  // Tracewell's stored generated layer: a whole copy of the brand, from the old applyGeneratedCopy.
  assert.equal(draft.generated.brand.address, draft.imported.brand.address, 'precondition: the old snapshot');
  const corrected = imported();
  corrected.brand.address = '1250 Tracer Ridge Rd, Winter Park, FL 32789';
  corrected.brand.phone = '4075550188';
  const out = effectiveContent('hvac', corrected, draft.generated, {});
  assert.equal(out.brand.address, corrected.brand.address);
  assert.equal(out.brand.phone.replace(/\D/g, '').replace(/^1/, ''), '4075550188');
  // The model's "LLC" legal name in that snapshot is gone too; the intake's stands.
  assert.equal(out.brand.long, corrected.brand.long);
  // Its tagline is generated copy, and is kept.
  assert.equal(out.brand.tagline, draft.generated.brand.tagline);
});

test("operator edits still win over the generated layer and the intake", () => {
  const imp = imported();
  const generated = applyGeneratedCopy(studioBase(imp), hostile, new Set(['brand']));
  const edits = { 'brand.tagline': 'We will Trace down those issues!', 'brand.address': '1300 Tracer Ridge Rd, Winter Park, FL 32789', 'brand.name': 'Tracewell Heating and Air' };
  const out = effectiveContent('hvac', imp, generated, edits);
  assert.equal(out.brand.tagline, edits['brand.tagline']);
  assert.equal(out.brand.address, edits['brand.address']);
  assert.equal(out.brand.name, edits['brand.name']);
});
