// "The copywriter never sets brand.long" (operator decision, 2026-11-11). Since agency PR #106,
// brand.long in a client's intake is the legal name exactly as signed on the agreement, e.g.
// "Tracewell Heating & Air LLC", and it feeds the footer's copyright line and the SEO
// local-business data (pageSeo.ts: `name: brand.long || brand.name`).
//
// What shipped: the output schema offered the model a `brand.long` string and applyGeneratedCopy
// copied it over the base with `if (cb.long) brand.long = cb.long`, so any generation run could
// replace the signed name with whatever the model wrote. Guarded at both layers the copywriter
// path touches, as no-generated-testimonials.test.mjs does: the output schema and the merge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCopySchema } from '../src/lib/copy-schema.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';
import { deepMerge, applyEdits } from '@jdd/ui/merge';

const SIGNED = 'Tracewell Heating & Air LLC';

function baseSite(long = SIGNED) {
  return {
    brand: {
      name: 'Tracewell Heating & Air', short: 'Tracewell', long, tagline: '', established: '2011',
      phone: '4075550177', phoneHref: 'tel:4075550177', email: '', address: '', license: '',
    },
  };
}

// What a model could return for the brand section, with a different legal name in it.
const hostile = { brand: { tagline: 'Comfort, on time.', long: 'Something Else Inc.' } };

test("the model's output schema does not offer brand.long", () => {
  for (const schema of [buildCopySchema([]), buildCopySchema(['brand'], false)]) {
    const b = schema.properties.brand;
    assert.ok(!('long' in b.properties), 'brand.long is still offered to the model');
    assert.ok(!b.required.includes('long'));
  }
});

// Since F-E6 (no-generated-identity.test.mjs) the generated brand holds only the tagline, so the
// legal name is not passed through either: it is simply absent, and the merge keeps the intake's.
test("applyGeneratedCopy keeps the intake's signed legal name when the model returns another", () => {
  const imported = baseSite();
  const generated = applyGeneratedCopy(imported, hostile, new Set(['brand']));
  assert.ok(!('long' in generated.brand), 'generated.brand.long was written');
  assert.equal(deepMerge(imported, generated).brand.long, SIGNED);
  // The rest of the brand section still lands.
  assert.equal(generated.brand.tagline, 'Comfort, on time.');
});

test('applyGeneratedCopy leaves an empty legal name empty rather than filling it from the model', () => {
  const imported = baseSite('');
  const generated = applyGeneratedCopy(imported, hostile, new Set(['brand']));
  assert.equal(deepMerge(imported, generated).brand.long, '');
});

test("an operator's edit to brand.long still wins over the generated layer", () => {
  // The Studio's layering: preset <- imported <- generated <- edits (BuildWizard.tsx).
  const imported = baseSite();
  const generated = applyGeneratedCopy(imported, hostile, new Set(['brand']));
  const effective = applyEdits(deepMerge(imported, generated), { 'brand.long': 'Tracewell Heating & Air, LLC' });
  assert.equal(effective.brand.long, 'Tracewell Heating & Air, LLC');
});
