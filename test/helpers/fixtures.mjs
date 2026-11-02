/**
 * test/helpers/fixtures.mjs — load the recorded vendor payloads.
 *
 * Not a .test.mjs file on purpose: importing a test file from another test file re-runs it.
 * (Same reason console/test/helpers/contrast.mjs exists.)
 *
 * Everything here reads test/fixtures/, which `npm run fixtures:refresh` captures from the
 * live APIs. Nothing is hand-written — see scripts/refresh-fixtures.js for why that matters.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = resolve(HERE, '..', 'fixtures');

export function loadFixture(relPath) {
  return JSON.parse(readFileSync(resolve(FIXTURES, relPath), 'utf8'));
}

/** The recorded master blueprint, fresh each call so a mutating test can't poison the next. */
export function masterBlueprint() {
  return loadFixture('make/master-blueprint.json').response.blueprint;
}

/**
 * The master base's Call Log schema as the `{ tableId, byName, byId, choices }` shape
 * `airtableFieldMap` returns from a live read. Built from the recorded schema so the test
 * joins on the SAME column names the real master uses.
 */
export function masterFieldMap() {
  const { baseId, table } = loadFixture('airtable/master-schema.json');
  const byName = {};
  const byId = {};
  const choices = {};
  for (const f of table.fields ?? []) {
    byName[f.name] = f.id;
    byId[f.id] = f.name;
    if (Array.isArray(f.options?.choices)) choices[f.name] = f.options.choices.map((c) => c.name);
  }
  return { baseId, tableId: table.id, byName, byId, choices };
}

/** A minimal, valid single-site intake. Overrides are merged shallowly onto brand/_meta. */
export function makeIntake({ plan = 'growth', receptionistMode = 'forwarded', sites = 1, brand = {}, smsAlerts = null } = {}) {
  const site = (i) => ({
    brand: {
      name: `Test Co ${i + 1}`,
      short: `tc${i + 1}`,
      long: 'Test Co Long Name',
      established: '2001',
      tagline: 'We test things',
      phone: '(207) 318-1838',
      phoneHref: 'tel:+12073181838',
      email: 'owner@example.com',
      address: '1 Test St, Orlando, FL 32801',
      license: 'LIC-1',
      palette: { accent: '#e08b29', bg: '#fff', bgSoft: '#f5f5f5', ink: '#111', inkSoft: '#555', rule: '#ddd' },
      typography: { fontSans: 'Inter', fontHeading: 'Inter', headingWeight: 700, bodyWeight: 400 },
      ...brand,
    },
    // validateSite checks ~25 fields, not the 7 an earlier version checked — the build runs
    // with `strict`, so an absent key is a step-5 failure AFTER the repo and secrets exist.
    // page.tsx calls .map() on both of these unguarded: empty is fine, absent is not.
    services: { eyebrow: '', title: '', sub: '', items: [] },
    faq: { eyebrow: '', title: '', sub: '', items: [] },
    // Nullable-but-required: the keys must exist, null is a legal value that costs a blank
    // spot on the page. hgco ships an all-null seo block and must stay re-provisionable.
    seo: { title: null, description: null, canonical: null, googleAnalyticsId: null, facebookPixelId: null },
    _meta: { missing_fields: [], selectedPlan: plan },
  });
  return {
    plan,
    receptionistMode,
    smsAlerts,
    sites: Array.from({ length: sites }, (_, i) => site(i)),
  };
}
