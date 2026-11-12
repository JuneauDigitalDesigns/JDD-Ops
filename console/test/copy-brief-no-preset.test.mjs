// The copy brief sends the model only what the client gave or the operator typed. Never the
// vertical preset's sample text, and never a previous run's generated copy.
//
// The bug (Tracewell Heating & Air, 2026-11-11). A self-serve HVAC client whose hours are Mon to
// Fri, 8am to 5pm, and who never claimed emergency service, got copy claiming 24/7 in nine places.
// The brief read its facts, its "Current promotion", its proof points and its reference hero from
// the merged content (preset <- imported <- generated <- edits), so every gap the client left was
// filled by the HVAC preset and handed to the model as this client's:
//   - promotion  "24/7 emergency HVAC service, call us any time, day or night!"  (announcement)
//   - reference  "Licensed & insured · 24/7 emergency service" / "AC out? We can be there today."
//   - facts      tagline "Comfort in every season.", the preset's own address and phone
//
// The fixture is the real draft from that run (test/fixtures/copy-brief/tracewell-draft.json).
// No model is called: these tests read the compiled prompt text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILT_IN_VERTICALS } from '@jdd/schema';
import { deepMerge, applyEdits } from '@jdd/ui/merge';
import { presetFor } from '../src/lib/verticals.ts';
import { ALL_SECTIONS } from '../src/lib/copy-schema.ts';
import { resolveBrief } from '../src/lib/copy-brief/resolve.ts';
import { compileBriefPrompt } from '../src/lib/copy-brief/compile-brief.ts';
import { chunkSections } from '../src/lib/copy-brief/chunking.ts';
import { withoutPreset, groundedContent } from '../src/lib/copy-brief/grounded.ts';

const draft = JSON.parse(readFileSync(new URL('./fixtures/copy-brief/tracewell-draft.json', import.meta.url), 'utf8'));
const hvac = BUILT_IN_VERTICALS.find((v) => v.id === 'hvac');
const preset = presetFor('hvac');

/** BuildWizard's `effective`: preset <- imported <- generated <- edits. */
function effectiveOf({ generated = null, edits = {} } = {}) {
  return applyEdits(deepMerge(deepMerge(preset, draft.imported), generated ?? {}), edits);
}

/** The whole prompt the route would send for every ticked section, every chunk joined.
 *
 *  The HVAC role is taken out of the system half before it is checked: its rules are the one
 *  place "24/7" is meant to appear, as a claim the model must NOT make unless the facts say it. */
function compiledBrief({ generated = null, edits = {}, brief = { blocks: {}, customFields: [] } } = {}) {
  const sections = ALL_SECTIONS.filter((s) => s !== 'brand' && s !== 'subpages');
  const ctx = {
    vertical: hvac, effective: effectiveOf({ generated, edits }), imported: draft.imported,
    preset, edits, brief, tickedSections: sections,
  };
  const blocks = resolveBrief(ctx);
  assert.match(hvac.prompt.role, /"24\/7" unless the facts say it/, 'the rule this test exempts');
  return chunkSections(sections)
    .map((chunk) => {
      const p = compileBriefPrompt(ctx, blocks, chunk);
      return `${p.system.replace(hvac.prompt.role.trim(), '[role]')}\n\n${p.user}`;
    })
    .join('\n\n');
}

const PRESET_STRINGS = [
  '24/7',
  'Comfort in every season',
  'CAC1234567',
  'AC out?',
  'Licensed & insured',
  'Your City',
  '(555) 555-0100',
  'owner@yourhvaccompany.com',
  'Your HVAC',
];

function assertNoPreset(prompt) {
  for (const s of PRESET_STRINGS) assert.ok(!prompt.includes(s), `preset text reached the model: "${s}"`);
}

test('a client with no announcement, tagline or 24/7 gets no preset text in the brief', () => {
  assertNoPreset(compiledBrief());
});

test('what the client did give still reaches the model', () => {
  const prompt = compiledBrief();
  for (const s of [
    'Mon to Fri, 8am to 5pm',         // hours
    'Within 2 hours',                 // response time
    'Upfront pricing no surprises',   // differentiators, in the client's words
    'CAC1800177',                     // the client's own licence
    '"Carrier"', '"Trane"',           // brands carried
    'Winter Park', 'Maitland', 'Oviedo',
    'TW Test Award 2025',             // the client's own proof point
    'Tess Tracewell',
    '1200 Tracer Ridge Rd',
    'Half a day', 'Sizing for your home', '$149', // the AC service page's own facts
    'Do you service all brands?',     // the client's own customer question
  ]) {
    assert.ok(prompt.includes(s), `client fact missing from the brief: "${s}"`);
  }
  assert.match(prompt, /Proof points: TW Test Award 2025\./);
  assert.match(prompt, /Service area: Winter Park\. Maitland\. Oviedo\./);
});

test('the facts heading no longer calls them the preset\'s', () => {
  const prompt = compiledBrief();
  assert.ok(!/intake \/ preset/.test(prompt));
  assert.match(prompt, /Business facts \(from the client's onboarding intake and the operator\)/);
});

test('the structure counts still come from the layout, with no preset reference text', () => {
  const prompt = compiledBrief();
  const m = prompt.match(/Existing structure to respect\. Keep these exact counts:\n(\{[\s\S]*?\n\})/);
  assert.ok(m, 'structure segment missing');
  const ref = JSON.parse(m[1]);
  assert.equal(ref.services, 3, 'the client\'s three services');
  assert.equal(ref.faq, 6);
  assert.equal(ref.reference?.hero, undefined, 'the client gave no hero, so none is referenced');
  assert.deepEqual(ref.reference?.serviceTags, ['Cooling', 'Heating']);
});

test('the operator\'s edits reach the model', () => {
  const prompt = compiledBrief({ edits: draft.edits });
  assert.ok(prompt.includes('We will Trace down those issues!'), 'edited tagline');
  assert.ok(prompt.includes('Tracewell Heating & Air LLC'), 'edited legal name');
  assert.ok(prompt.includes('Current promotion: We respond withing 2 hours!'), 'edited announcement, as typed');
  // (The draft's other text edit, services.items.1.duration, is on a service with no page of its
  // own, so no prompt line carries it: nothing to assert either way.)
});

test('an operator edit to a service with its own page reaches that page\'s facts', () => {
  const prompt = compiledBrief({ edits: { ...draft.edits, 'services.items.0.duration': 'About three hours' } });
  assert.match(prompt, /"howLong": "About three hours"/);
  assert.ok(!prompt.includes('Half a day'), 'the edit replaces the client value it was typed over');
});

test('a previous run\'s generated copy is never sent back as a reference', () => {
  // With the bad run merged in, `effective` carries its invented 24/7 badge, headline and
  // announcement. None of it may be fed to the next run.
  const prompt = compiledBrief({ generated: draft.generated });
  assertNoPreset(prompt);
  for (const s of ['day or night', 'Heating and air repair in Winter Park', 'Locally owned, licensed']) {
    assert.ok(!prompt.includes(s), `generated text reached the model: "${s}"`);
  }
});

test('a saved chip selection cannot carry a preset badge forward', () => {
  // Saved while proof points were still offered from the preset.
  const brief = { blocks: { offers: { enabled: true, overrides: { 'proof.selected': ['24/7 emergency service', 'TW Test Award 2025'] } } }, customFields: [] };
  const prompt = compiledBrief({ brief });
  assert.ok(!prompt.includes('24/7'));
  assert.match(prompt, /Proof points: TW Test Award 2025\./);
});

test('a close-seeded client, whose imported content IS the preset, sends none of it', () => {
  const imported = deepMerge(preset, { brand: { name: 'Northline Air' } });
  const g = groundedContent({ imported, preset, edits: {} });
  assert.deepEqual(g, { brand: { name: 'Northline Air' } });
});

test('withoutPreset drops the preset\'s own list, and keeps a client list that shares items with it', () => {
  assert.equal(withoutPreset([...preset.extensions.trustBadges], preset.extensions.trustBadges), undefined);
  // The preset's sample towns are real towns: a client serving three of them keeps all three.
  assert.deepEqual(withoutPreset(['Winter Park', 'Maitland', 'Oviedo'], preset.extensions.serviceArea), ['Winter Park', 'Maitland', 'Oviedo']);
  assert.deepEqual(withoutPreset(['', null, 'Own badge'], preset.extensions.trustBadges), ['Own badge']);
  assert.equal(withoutPreset('  comfort in every season. ', 'Comfort in every season.'), undefined);
  assert.equal(withoutPreset('', 'x'), undefined);
});
