// Phase 10a: the per-section-per-page verdict key (decision 50) and the load-time normaliser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictKey, parseVerdictKey } from '../src/lib/copy-schema.ts';
import { normalizeVerdicts } from '../src/lib/copy-brief/mutations.ts';
import { buildReviewGroups, reviewKeys, HOME_SECTIONS } from '../src/lib/copy-review-groups.ts';

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

test('a per-page verdict key round-trips through parseVerdictKey (Phase 10b)', () => {
  // A section on a non-home page is approved independently of the home one (decision 50).
  const k = verdictKey('subpages', 'about');
  assert.equal(k, 'about:subpages');
  assert.deepEqual(parseVerdictKey(k), { route: 'about', section: 'subpages' });
  // A service route keeps its slash; only the ONE section delimiter is a colon.
  assert.deepEqual(parseVerdictKey('services/ac-repair:subpages'), { route: 'services/ac-repair', section: 'subpages' });
});

test('buildReviewGroups orders home → Services → About → Contact → service pages (decision 49)', () => {
  const groups = buildReviewGroups([
    { route: 'services/heating', label: 'Heating', pageType: 'service' },
    { route: 'about', label: 'About', pageType: 'about' },
    { route: 'services/ac-repair', label: 'AC Repair', pageType: 'service' },
    { route: 'contact', label: 'Contact', pageType: 'contact' },
    { route: 'services', label: 'Services', pageType: 'services' },
  ]);
  assert.deepEqual(groups.map((g) => g.route), [
    '', 'services', 'about', 'contact', 'services/ac-repair', 'services/heating',
  ]);
  // Home carries the full site content; the Services page also carries its per-service prose.
  assert.deepEqual(groups[0].sections, HOME_SECTIONS);
  assert.deepEqual(groups[1].sections, ['subpages', 'services']);
  assert.deepEqual(groups[2].sections, ['subpages']);
});

test('reviewKeys prefixes every non-home key with its route and leaves home bare', () => {
  const groups = buildReviewGroups([{ route: 'about', label: 'About', pageType: 'about' }]);
  const keys = reviewKeys(groups);
  assert.ok(keys.includes('hero'), 'home section stays bare');
  assert.ok(keys.includes('about:subpages'), 'non-home section is route-prefixed');
  assert.ok(!keys.includes('subpages'), 'no bare subpages key leaks in');
});
