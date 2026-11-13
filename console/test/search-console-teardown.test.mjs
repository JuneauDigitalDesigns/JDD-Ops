// L11 teardown: JDD leaves Google Search Console in the order Google requires.
// Recorded 2026-11-13 on e2eteststarter.vercel.app: relinquishing while JDD's token file is still
// served is refused (400, jdd-ops test/fixtures/google/relinquish-while-token-served.json). The
// token file goes away with the Vercel project and the repo, so the Search Console step must come
// after both, and the properties must be captured in the plan before Vercel forgets the hosts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../src/app/api/manage/teardown/route.ts', import.meta.url), 'utf8');
const plan = readFileSync(new URL('../src/lib/teardownPlan.ts', import.meta.url), 'utf8');

test('the Search Console step runs after the Vercel project and the repo are deleted', () => {
  const vercel = route.indexOf('`Delete Vercel project (${site.siteSlug})`');
  const repo = route.indexOf('`Delete GitHub repo (${site.siteSlug})`');
  const gsc = route.indexOf('`Google Search Console (${site.siteSlug})`');
  assert.ok(vercel > 0 && repo > 0, 'anchors moved; update this test');
  assert.ok(gsc > vercel && gsc > repo, 'leaving Search Console before the site is gone gets a 400 from Google');
  assert.match(route.slice(gsc - 200, gsc + 200), /leaveSearchConsoleProperty\(property\)/);
});

test('the properties JDD holds are captured in the preview, and in the hash the destroy call must echo', () => {
  assert.match(plan, /searchConsole: \{ properties: gscProperties \}/);
  assert.match(plan, /gscProperties: s\.searchConsole\.properties/);
  const hashAt = plan.indexOf('const previewHash = hashPlan(');
  assert.ok(plan.indexOf('gscProperties: s.searchConsole.properties') < hashAt, 'identifiersForHash carries them');
});
