/**
 * Slug, directory and Site-tag derivation.
 *
 * Small pure functions, but they decide where a client's repo lives, what the Vercel project
 * is called, and which Airtable rows the portal shows which site. The enterprise Site tag in
 * particular has already caused a real bug — see below.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { basename } from 'node:path';

import { deriveBaseSlug, isMultiSite, siteSlugFor, siteDirFor, siteTagFor, intakeIsWebOnly } from '../onboard.js';
import { makeIntake } from './helpers/fixtures.mjs';

const single = makeIntake({ plan: 'growth', sites: 1 });
const multi = makeIntake({ plan: 'enterprise', sites: 3 });

test('the slug comes from the clients/{slug}/ path segment', () => {
  assert.equal(deriveBaseSlug('clients/acme-hvac/site.ts'), 'acme-hvac');
  assert.equal(deriveBaseSlug('clients/acme-hvac/site-1/site.ts'), 'acme-hvac');
  // Windows separators — this repo runs on win32.
  assert.equal(deriveBaseSlug('clients\\acme-hvac\\site.ts'), 'acme-hvac');
});

test('a path outside clients/ falls back to the containing directory', () => {
  assert.equal(deriveBaseSlug('somewhere/else/acme/site.ts'), 'acme');
});

test('multi-site is the single definition, and tracks site count', () => {
  assert.equal(isMultiSite(single), false);
  assert.equal(isMultiSite(multi), true);
});

test('a single-site client uses the base slug unchanged', () => {
  assert.equal(siteSlugFor('acme', single, 0), 'acme');
  assert.equal(basename(siteDirFor('acme', single, 0)), 'acme');
});

test('enterprise sites are numbered from 1, not 0', () => {
  assert.equal(siteSlugFor('acme', multi, 0), 'acme-1');
  assert.equal(siteSlugFor('acme', multi, 1), 'acme-2');
  assert.equal(siteSlugFor('acme', multi, 2), 'acme-3');
  assert.equal(basename(siteDirFor('acme', multi, 0)), 'site-1');
  assert.equal(basename(siteDirFor('acme', multi, 2)), 'site-3');
});

test('EVERY enterprise site gets a Site tag, including the first', () => {
  // The shipped bug: only sites 2+ were tagged. Site 1's rows went in untagged, and the
  // portal — which filters `row.Site === site.slug` — shows untagged rows under every site,
  // so each location saw the others' calls.
  const tags = multi.sites.map((_, i) => siteTagFor('acme', multi, i));
  assert.deepEqual(tags, ['acme-1', 'acme-2', 'acme-3']);
  assert.ok(tags.every(Boolean), 'no enterprise site may be left untagged');
});

test('the Site tag is the provisioning slug, not brand.short', () => {
  // The portal matches against site.slug. brand.short ("tc1") would filter every row out.
  assert.equal(siteTagFor('acme', multi, 0), siteSlugFor('acme', multi, 0));
  assert.notEqual(siteTagFor('acme', multi, 0), multi.sites[0].brand.short);
});

test('a single-site client gets no Site tag at all', () => {
  assert.equal(siteTagFor('acme', single, 0), null);
});

test('web-only is starter + declined, and nothing else is', () => {
  assert.equal(intakeIsWebOnly(makeIntake({ plan: 'starter', receptionistMode: 'declined' })), true);
  assert.equal(intakeIsWebOnly(makeIntake({ plan: 'starter', receptionistMode: 'forwarded' })), false);
  assert.equal(intakeIsWebOnly(makeIntake({ plan: 'starter', receptionistMode: 'published' })), false);
  assert.equal(intakeIsWebOnly(makeIntake({ plan: 'growth', receptionistMode: 'forwarded' })), false);
});
