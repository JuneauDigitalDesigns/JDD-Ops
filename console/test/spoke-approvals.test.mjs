// Phase 3: a spoke ships only when it was approved in Search (jdd-ops lib/search-approvals.js).
//
// Two holes the Local SEO lead named (2026-11-13), both closed here:
//   1. The Studio's town-page sync removes every spoke not in the approved list. Run with [] before
//      the list has loaded, it strips a client's live spokes, and the next export 308s their URLs.
//      So the sync waits for the list, and a failed load keeps waiting.
//   2. The export's SEO score checks a spoke with qualifiesForSpokePage(..., true): it trusts that
//      an approval exists. So the export itself refuses a spoke route that isn't approved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unapprovedSpokeRoutes } from '../src/lib/spokeApprovals.ts';

const content = { extensions: { serviceArea: ['Clermont', 'Minneola', 'Winter Garden'] } };
const pages = [
  { route: '', pageType: 'home' },
  { route: 'areas/minneola', pageType: 'area' },
  { route: 'areas/minneola/ac-repair', pageType: 'spoke' },
  { route: 'areas/winter-garden/ac-repair', pageType: 'spoke' },
];

test('a spoke route with no approval behind it is named; town case does not matter', () => {
  assert.deepEqual(unapprovedSpokeRoutes(pages, content, [{ town: 'minneola', service: 'ac-repair' }]), ['areas/winter-garden/ac-repair']);
  assert.deepEqual(unapprovedSpokeRoutes(pages, content, [
    { town: 'Minneola', service: 'ac-repair' }, { town: 'Winter Garden', service: 'ac-repair' },
  ]), []);
  assert.deepEqual(unapprovedSpokeRoutes(pages, content, []), ['areas/minneola/ac-repair', 'areas/winter-garden/ac-repair']);
  assert.deepEqual(unapprovedSpokeRoutes(pages.slice(0, 2), content, []), [], 'no spokes, nothing to approve');
});

const wizard = readFileSync(new URL('../src/app/c/[slug]/build/BuildWizard.tsx', import.meta.url), 'utf8');

test('the Studio syncs town pages only once the approved list has loaded', () => {
  assert.match(wizard, /useState<ApprovedSpoke\[\] \| null>\(null\)/, 'null until loaded');
  const at = wizard.indexOf('chosenSpokePages(effective, approvedSpokes)');
  assert.ok(at > 0, 'the sync passes the loaded list, not []');
  assert.doesNotMatch(wizard, /chosenSpokePages\(effective, \[\]\)/);
  const effect = wizard.slice(wizard.lastIndexOf('useEffect(', at), at);
  assert.match(effect, /if \(approvedSpokes === null\) return;/, 'held until the list arrives');
  // A failed load must leave it null, never [] (which would strip every spoke).
  const load = wizard.slice(wizard.indexOf('/api/manage/search-console/approved'), wizard.indexOf('/api/manage/search-console/approved') + 600);
  assert.doesNotMatch(load, /setApprovedSpokes\(\[\]\)/);
});

test('the export refuses a spoke that was not approved, before anything is written', () => {
  const route = readFileSync(new URL('../src/app/api/build/export/route.ts', import.meta.url), 'utf8');
  const seo = route.indexOf('const passesSeo = (c: SiteContent): boolean => {');
  const check = route.indexOf('unapprovedSpokeRoutes(', seo);
  assert.ok(seo > 0 && check > seo && check < route.indexOf('scoreSite(', seo), 'checked inside passesSeo, before the score');
  assert.ok(route.indexOf('readApprovedSpokesFor(slug)') > 0, 'from this client\'s own approved list');
});
