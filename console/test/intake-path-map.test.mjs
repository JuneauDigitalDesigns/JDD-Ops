// intake-path-map.ts translates `_meta.missing_fields` entries — which are ONBOARDING-FORM
// paths, not SiteContent paths — into real SiteContent paths, or flags them as unmappable
// with an explanatory note. This is the fix for the "Needs review" rows that used to render
// inputs bound to paths like "business.industry" that resolve to nothing (D1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapIntakePath, mapIntakePaths } from '../src/lib/intake-path-map.ts';

test('a path shared by both trees passes through unchanged', () => {
  for (const p of ['brand.phone', 'brand.email', 'brand.address', 'brand.license', 'brand.established', 'seo.canonical']) {
    assert.deepEqual(mapIntakePath(p), { formPath: p, contentPath: p });
  }
});

test('branding.logo maps to the real SiteImages leaf', () => {
  const m = mapIntakePath('branding.logo');
  assert.equal(m.contentPath, 'images.footer.logoImage');
  assert.equal(m.note, undefined);
});

test('hero.bullets (the form path) maps to hero.heroBullets (the real SiteContent path)', () => {
  const m = mapIntakePath('hero.bullets');
  assert.equal(m.contentPath, 'hero.heroBullets');
});

test('business.industry is unmappable and points at the vertical picker', () => {
  const m = mapIntakePath('business.industry');
  assert.equal(m.contentPath, null);
  assert.ok(m.note && m.note.length > 0);
});

test('services.items is unmappable rather than bound to the whole array', () => {
  // Binding a text Field to this path would stringify the array on read and, on any edit,
  // setField would overwrite the entire services list with a string — silent data loss.
  const m = mapIntakePath('services.items');
  assert.equal(m.contentPath, null);
});

test('images.hero is unmappable (no single leaf to bind)', () => {
  assert.equal(mapIntakePath('images.hero').contentPath, null);
});

test('existingWebsiteUrl is unmappable — there is no SiteContent equivalent at all', () => {
  const m = mapIntakePath('existingWebsiteUrl');
  assert.equal(m.contentPath, null);
  assert.ok(m.note);
});

test('an unrecognised path is passed through unchanged (assumed already valid)', () => {
  assert.deepEqual(mapIntakePath('some.new.field'), { formPath: 'some.new.field', contentPath: 'some.new.field' });
});

test('the decision-29 specificity fields map to their content paths (Phase 13)', () => {
  assert.equal(mapIntakePath('ownerName').contentPath, 'extensions.ownerName');
  assert.equal(mapIntakePath('brandsCarried').contentPath, 'trust.logos');
  assert.equal(mapIntakePath('responseTime').contentPath, 'extensions.responseTime');
  // And the content paths buildScaffold actually flags pass straight through, so editing works
  // whichever shape the flag takes.
  for (const p of ['extensions.ownerName', 'extensions.responseTime', 'extensions.serviceArea', 'trust.logos']) {
    assert.equal(mapIntakePath(p).contentPath, p);
  }
});

test('mapIntakePaths preserves order and de-duplicates by resolved contentPath', () => {
  const out = mapIntakePaths(['brand.phone', 'branding.logo', 'brand.phone']);
  assert.equal(out.length, 2);
  assert.equal(out[0].contentPath, 'brand.phone');
  assert.equal(out[1].contentPath, 'images.footer.logoImage');
});

test('mapIntakePaths de-duplicates unmappable entries by their own form path, not by null', () => {
  // Two different unmappable paths must both survive — they'd otherwise collapse to one row
  // because they share the same `contentPath: null`.
  const out = mapIntakePaths(['business.industry', 'existingWebsiteUrl']);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((m) => m.formPath), ['business.industry', 'existingWebsiteUrl']);
});

test('a real client missing_fields array (arthur-s-plumbing) maps without throwing', () => {
  // Regression fixture: the shape actually seen in clients/arthur-s-plumbing/site.ts.
  const out = mapIntakePaths(['existingWebsiteUrl']);
  assert.equal(out.length, 1);
  assert.equal(out[0].contentPath, null);
});

test('a vertical-preset missing_fields array maps every entry to a resolvable path', () => {
  // Every preset in data/verticals/*.ts hardcodes this exact five-entry list.
  const out = mapIntakePaths(['brand.name', 'brand.phone', 'brand.email', 'brand.address', 'seo.canonical']);
  assert.equal(out.length, 5);
  for (const m of out) assert.equal(m.contentPath, m.formPath);
});
