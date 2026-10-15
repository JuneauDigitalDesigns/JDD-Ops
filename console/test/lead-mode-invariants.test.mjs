// Lead-mode invariants — locks the starter/email vs growth-enterprise/phone mapping to one
// source (@jdd/schema's leadModeFor) and locks the set of components that actually capture a
// lead, so a new form component that forgets to join LEAD_FORM_NAMES is caught here instead of
// shipping a site that silently captures nothing. See PLAN-tier-form-wiring-console.md §5.
//
// Run: npm test   (node's built-in runner — no new dependency)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leadModeFor } from '@jdd/schema';
import { LEAD_FORM_NAMES } from '../src/lib/leadForms.ts';
import { validateComposition } from '../src/lib/pages.ts';
import { defaultCompositionFor } from '../src/app/c/[slug]/build/page-templates.tsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(ROOT, 'src/components/catalog');

/** Every catalog component file, as { name, rel, src }. */
function components() {
  const out = [];
  for (const cat of readdirSync(CATALOG_DIR)) {
    const dir = path.join(CATALOG_DIR, cat);
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.tsx')) continue;
      out.push({ name: f.replace('.tsx', ''), rel: `${cat}/${f}`, src: readFileSync(path.join(dir, f), 'utf8') });
    }
  }
  return out;
}

const ALL = components();

test('no catalog component hand-rolls the starter/growth ternary any more', () => {
  const offenders = ALL.filter((c) => /selectedPlan\s*===\s*'starter'\s*\?\s*'email'\s*:\s*'phone'/.test(c.src));
  assert.deepEqual(
    offenders.map((c) => c.rel),
    [],
    `inline leadMode ternary found outside leadModeFor:\n${offenders.map((c) => c.rel).join('\n')}`,
  );
});

test('the six form-bearing components import leadModeFor from @jdd/schema', () => {
  for (const name of LEAD_FORM_NAMES) {
    const c = ALL.find((x) => x.name === name);
    assert.ok(c, `${name} not found under src/components/catalog`);
    assert.match(c.src, /leadModeFor/, `${name} does not call leadModeFor`);
  }
});

test('leadModeFor is the single starter/email vs growth-enterprise/phone mapping', () => {
  assert.equal(leadModeFor('starter'), 'email');
  assert.equal(leadModeFor('growth'), 'phone');
  assert.equal(leadModeFor('enterprise'), 'phone');
});

test('LEAD_FORM_NAMES matches exactly the components that render <LeadForm>', () => {
  const rendersLeadForm = new Set(ALL.filter((c) => /<LeadForm\b/.test(c.src)).map((c) => c.name));
  assert.deepEqual(
    [...rendersLeadForm].sort(),
    [...LEAD_FORM_NAMES].sort(),
    'LEAD_FORM_NAMES (src/lib/leadForms.ts) has drifted from which components render <LeadForm>',
  );
});

test('FinalCtaSimple renders no <LeadForm> and is not in LEAD_FORM_NAMES', () => {
  const c = ALL.find((x) => x.name === 'FinalCtaSimple');
  assert.ok(c);
  assert.doesNotMatch(c.src, /<LeadForm\b/);
  assert.ok(!LEAD_FORM_NAMES.has('FinalCtaSimple'));
});

test('a representative 4-page composition passes the lead-form invariants', () => {
  assert.doesNotThrow(() => validateComposition(defaultCompositionFor()));
});

test('validateComposition throws when no page has a lead-capture form', () => {
  const c = defaultCompositionFor();
  for (const page of c.pages) {
    page.sections = page.sections.filter((s) => !LEAD_FORM_NAMES.has(s.name));
  }
  assert.throws(() => validateComposition(c), /no lead-capture form/i);
});

test('validateComposition throws when the Contact page has no lead-capture form', () => {
  const c = defaultCompositionFor();
  const contact = c.pages.find((p) => p.route === 'contact');
  assert.ok(contact, 'default composition has no contact page to test against');
  contact.sections = contact.sections.filter((s) => !LEAD_FORM_NAMES.has(s.name));
  assert.throws(() => validateComposition(c), /Contact page has no lead form/i);
});
