// Xander, 2026-11-12: "fix the town picker so it never suggests sample towns." The Services step's
// "Towns this service covers" picker offers the client's own towns and never a preset's sample
// list. The list is presetIdentity's RETIRED_SAMPLE_LISTS (#88), judged as a whole list the same
// way: an Orlando client still gets Orlando.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { townChoices } from '../src/lib/service-areas.ts';
import { RETIRED_SAMPLE_LISTS } from '../src/lib/presetIdentity.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('every sample town list a preset shipped is never offered', () => {
  for (const { list } of RETIRED_SAMPLE_LISTS['extensions.serviceArea']) {
    assert.deepEqual(townChoices(list), [], String(list[0]));
  }
});

test('_e2e_test_starter\'s imported area, the twelve Orlando sample towns, offers nothing', () => {
  const imported = ['Orlando', 'Winter Park', 'Kissimmee', 'Apopka', 'Sanford', 'Oviedo', 'Lake Mary', 'Altamonte Springs', 'Clermont', 'Longwood', 'Maitland', 'Casselberry'];
  assert.deepEqual(townChoices(imported), []);
});

test('the client\'s own towns are offered, even where they share towns with a sample', () => {
  const own = ['Winter Park', 'Maitland', 'Orlando', 'Altamonte Springs', 'Oviedo'];
  assert.deepEqual(townChoices(own), own);
  assert.deepEqual(townChoices(['Oviedo', ' oviedo ', '', 'Sanford']), ['Oviedo', 'Sanford']);
  assert.deepEqual(townChoices(undefined), []);
});

test('the Services step\'s town picker takes its options from townChoices', () => {
  const src = readFileSync(path.join(ROOT, 'src/components/wizard/intake/ServicesStep.tsx'), 'utf8');
  assert.match(src, /townChoices\(content\.extensions\?\.serviceArea\)/);
  assert.doesNotMatch(src, /const area = content\.extensions\?\.serviceArea \?\? \[\]/);
});
