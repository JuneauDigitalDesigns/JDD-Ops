// Phase 10a: the per-section-per-page verdict key (decision 50) and the load-time normaliser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictKey, parseVerdictKey } from '../src/lib/copy-schema.ts';
import { normalizeVerdicts } from '../src/lib/copy-brief/mutations.ts';

test('verdictKey / parseVerdictKey round-trip', () => {
  assert.equal(verdictKey('hero'), 'hero');
  assert.equal(verdictKey('services', 'services/ac-repair'), 'services/ac-repair:services');
  assert.deepEqual(parseVerdictKey('hero'), { section: 'hero' });
  assert.deepEqual(parseVerdictKey('services/ac-repair:services'), { route: 'services/ac-repair', section: 'services' });
});

test('normalizeVerdicts keeps bare ids as home keys and never fans out to routes', () => {
  // The exact failure decision 51's gate prevents: a bare id must NOT become a per-route key, which
  // would silently mark unreviewed service pages as reviewed.
  const brief = { blocks: {}, customFields: [], tickedSections: ['hero', 'services'] };
  const out = normalizeVerdicts(brief);
  assert.deepEqual(out.tickedSections, ['hero', 'services']);
  assert.ok(!out.tickedSections.some((k) => k.includes(':')), 'no per-route keys invented');
});

test('normalizeVerdicts dedupes without reordering', () => {
  const out = normalizeVerdicts({ blocks: {}, customFields: [], tickedSections: ['hero', 'hero', 'services'] });
  assert.deepEqual(out.tickedSections, ['hero', 'services']);
});
