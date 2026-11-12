// No preset's sample towns ever ship as the towns a client serves (operator decision, 2026-11-12).
// Companion to no-sample-projects.test.mjs and preset-claims-no-fallthrough.test.mjs.
//
// The HVAC preset has carried a "Where we work" list since 389632a: six Juneau-area towns, then
// twelve around Orlando. The merge (`preset <- imported <- generated <- edits`) reads null and [] as
// missing, so a client who listed no towns was shown the preset's, in the service-area section, on
// every service page and in the LocalBusiness JSON-LD's areaServed. A copy run or an import bakes
// them in: Xander's draft for clients/_e2e_test_growth holds the twelve, in the preset's order, as
// its imported extensions.serviceArea.
//
// The rule, Xander's: a client with no towns shows none, and their own towns are kept. A town list
// is judged whole (lib/presetIdentity.ts RETIRED_SAMPLE_LISTS), never town by town: an Orlando
// client really does serve Orlando and Winter Park.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { presetFor, VERTICALS } from '../src/lib/verticals.ts';
import { effectiveContent } from '../src/lib/effectiveContent.ts';
import { stripPresetIdentity, isSampleList } from '../src/lib/presetIdentity.ts';
import { businessNode } from '../src/lib/pageSeo.ts';

globalThis.React = React;

const draft = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/drafts/e2e-test-growth-2026-11-11.json', import.meta.url)), 'utf8'));
const effective = effectiveContent(draft.vertical, draft.imported, draft.generated, draft.edits);
const clone = (v) => JSON.parse(JSON.stringify(v));

// Verbatim from console/src/data/verticals/hvac.ts's history (389632a and later).
const JUNEAU = ['Juneau', 'Douglas', 'Mendenhall Valley', 'Auke Bay', 'Lemon Creek', 'Thane'];
const ORLANDO = ['Orlando', 'Winter Park', 'Kissimmee', 'Apopka', 'Sanford', 'Oviedo', 'Lake Mary', 'Altamonte Springs', 'Clermont', 'Longwood', 'Maitland', 'Casselberry'];

test('no industry preset carries sample towns', () => {
  for (const v of VERTICALS) {
    assert.deepEqual(presetFor(v.id).extensions?.serviceArea ?? [], [], `${v.id} preset still ships sample towns`);
  }
});

test('every town list a preset has shipped is retired', () => {
  assert.ok(isSampleList('extensions.serviceArea', JUNEAU), 'the Juneau list');
  assert.ok(isSampleList('extensions.serviceArea', ORLANDO), 'the Orlando list');
});

test("the refused draft's Studio content shows no towns: its list is the preset's twelve", () => {
  assert.deepEqual(draft.imported.extensions.serviceArea, ORLANDO, 'the fixture holds the sample list');
  assert.deepEqual(effective.extensions.serviceArea ?? [], []);
  assert.equal(businessNode(effective, draft.vertical).areaServed, undefined, 'areaServed names no town');
});

test('a client with no towns shows no service-area section', async () => {
  const content = effectiveContent('hvac', { ...clone(draft.imported), extensions: { ...draft.imported.extensions, serviceArea: null } }, null, {});
  assert.deepEqual(content.extensions.serviceArea ?? [], []);
  for (const path of ['trust/HvacServiceArea.tsx', 'trust/ServiceArea.tsx']) {
    const { default: C } = await import(`../src/components/catalog/${path}`);
    assert.equal(renderToStaticMarkup(React.createElement(C, { content })), '', `${path} still renders towns`);
  }
});

test("a client's own towns are kept, even where they share towns with the sample", () => {
  for (const own of [
    ['Orlando', 'Winter Park', 'Ocoee'],
    ORLANDO.slice(0, 11), // the sample with a town taken out is the operator's edit
    [...ORLANDO].reverse(),
  ]) {
    const imported = { ...clone(draft.imported), extensions: { ...draft.imported.extensions, serviceArea: own } };
    assert.deepEqual(effectiveContent('hvac', imported, null, {}).extensions.serviceArea, own);
  }
});

test("the operator's per-service towns are not touched", () => {
  assert.deepEqual(effective.services.items[0].areas, draft.edits['services.items.0.areas']);
  assert.deepEqual(effective.services.items[1].areas, draft.edits['services.items.1.areas']);
});

test('the export gate removes them too, under its existing log line', () => {
  const { content, removed } = stripPresetIdentity({ extensions: { serviceArea: [...JUNEAU] } });
  assert.deepEqual(content.extensions.serviceArea, []);
  assert.deepEqual(removed.map((r) => r.path), ['extensions.serviceArea']);
  // Every site.ts write goes through stripPresetIdentity (seo-canonical-no-preset.test.mjs pins
  // the chain), and its step line already names each path it empties: no new wording.
  const route = readFileSync(fileURLToPath(new URL('../src/app/api/build/export/route.ts', import.meta.url)), 'utf8');
  assert.match(route, /stripPresetIdentity\(c\)/);
});
