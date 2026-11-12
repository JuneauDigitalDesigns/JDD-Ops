// No sample job ever reaches a client site as the client's work (operator decision, 2026-11-12).
// Companion to no-sample-reviews.test.mjs, same shape.
//
// The HVAC preset carried three sample jobs ("Full system replacement", Clermont, FL; "Ductless
// mini-split install", Winter Garden, FL; "Emergency AC repair", Groveland, FL), and the default
// seed three more in Juneau. `effective = preset <- imported <- generated <- edits` let them
// through, and Xander's draft for clients/_e2e_test_growth carries them in every layer: imported,
// generated, and an operator edit of work.projects that added four real photo jobs after them. The
// client is in Orlando. The SEO check flagged them as preset copy, 15 of 26 warnings.
//
// Second half: the preset-copy warning skips the service names and tags the intake picked (they are
// the client's choice, picked from the industry's menu, so they equal the preset's by design), and
// nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { presetFor, VERTICALS } from '../src/lib/verticals.ts';
import { effectiveContent } from '../src/lib/effectiveContent.ts';
import { copyRisks } from '../src/lib/copyRisks.ts';

const src = (rel) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');
const draft = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/drafts/e2e-test-growth-2026-11-11.json', import.meta.url)), 'utf8'));
const effective = effectiveContent(draft.vertical, draft.imported, draft.generated, draft.edits);
const SAMPLE_PLACES = /Clermont, FL|Winter Garden, FL|Groveland, FL|Juneau, AK|Mendenhall Valley, AK/;
const clone = (v) => JSON.parse(JSON.stringify(v));
// Loaded per test, so every other test still runs (and fails on its own) where the module is missing.
const lib = () => import('../src/lib/sampleProjects.ts');

test('no industry preset carries a sample job', () => {
  for (const v of VERTICALS) {
    assert.deepEqual((presetFor(v.id).work?.projects ?? []).map((p) => p.t), [], `${v.id} preset still ships sample jobs`);
  }
});

test('the default seed carries no sample job', () => {
  // Read as source: importing data/site.ts under tsx trips @jdd/schema's package exports.
  const s = src('data/site.ts');
  const i = s.indexOf('work: {');
  assert.ok(i > 0, 'default seed has no work block');
  const block = s.slice(i, s.indexOf('testimonials', i));
  assert.ok(!/\bloc:\s*["'][^"']/.test(block), 'the default seed still ships a sample job');
});

test("the refused draft's Studio content has no sample job, and keeps the client's four photo jobs", () => {
  const projects = effective.work.projects;
  assert.deepEqual(projects.filter((p) => SAMPLE_PLACES.test(p.loc ?? '')).map((p) => `${p.t} (${p.loc})`), []);
  assert.deepEqual(projects.map((p) => p.image?.url), [
    'upload://a411bab6-c02b-423d-9375-a689ea2241b4.jpg',
    'upload://d68f8deb-0223-40ee-b47e-296ae9f0f0b5.jpg',
    'upload://5e43fdbd-c1f6-4afa-9c5a-029bd97a87d5.jpg',
    'upload://471a8f3d-304c-4b1e-8f18-daa01ce75c8f.jpg',
  ]);
});

test('a real job that shares only a title with a sample is kept; a sample with one field rewritten is not', async () => {
  const { stripSampleProjects } = await lib();
  const real = { t: 'Emergency AC repair', loc: 'Orlando, FL', yr: '2026', scope: 'Capacitor swap on a Saturday.', size: '', caption: '', image: null };
  // The copywriter may reword one field of a sample it was handed; the place and the job are still invented.
  const reworded = { t: 'Ductless mini-split install', loc: 'Winter Garden, FL', yr: '2026', scope: 'A two-zone system for a garage suite.', size: '', caption: 'Photo: mini-split', image: null };
  const content = { work: { eyebrow: 'E', title: 'T', hidden: false, projects: [reworded, real] } };
  const { content: out, removed } = stripSampleProjects(content);
  assert.equal(removed, 1);
  assert.deepEqual(out.work.projects, [real]);
  assert.equal(content.work.projects.length, 2, 'input must not be mutated');
});

test('the match ignores case and punctuation, and covers the seed and the preview-only sets', async () => {
  const { isSampleProject } = await lib();
  assert.ok(isSampleProject({ t: 'full system replacement', loc: 'Clermont FL', scope: '' }));
  assert.ok(isSampleProject({ t: 'Single-Family Plumbing Repipe', loc: 'Mendenhall Valley, AK', scope: 'Residential plumbing' }));
  // fillImagePlaceholders' includeWork set (data/image-placeholders.ts): preview-only by design,
  // listed so one that ever leaked into a saved draft is caught too.
  assert.ok(isSampleProject({ t: 'Whole-Home Repipe', loc: 'Denver, CO', scope: 'Repipe' }));
  assert.ok(!isSampleProject({ t: 'Furnace Repair & Replacement', loc: '', scope: 'Furnace Repair & Replacement' }));
});

test('a work section the strip empties is hidden, never shown empty', async () => {
  const { stripSampleProjects } = await lib();
  const baked = { t: 'Full system replacement', loc: 'Clermont, FL', yr: '2026', scope: '3-ton high-efficiency heat pump, one day turnaround.', size: '', caption: 'Photo: install', image: null };
  const { content: out } = stripSampleProjects({ work: { eyebrow: 'E', title: 'T', hidden: false, projects: [baked] } });
  assert.deepEqual(out.work.projects, []);
  assert.equal(out.work.hidden, true);
});

test('the export strips sample jobs before it writes site.ts, on every branch', () => {
  const s = src('app/api/build/export/route.ts');
  assert.equal((s.match(/const shipped = withoutSampleReviews\(withoutSampleProjects\(/g) ?? []).length, 3, 'every branch must build its content through withoutSampleProjects');
  assert.match(s, /stripSampleProjects\(c\)/);
});

test('the Studio strips them too, so the preview matches the export', () => {
  assert.match(src('lib/effectiveContent.ts'), /stripSampleProjects\(/);
});

// ── The preset-copy warning ──

test("the service names and tags the intake picked are not preset copy; everything else still is", async () => {
  const { intakeServicePicks } = await import('../src/lib/copyRisks.ts');
  assert.equal(typeof intakeServicePicks, 'function', 'copyRisks.ts exports intakeServicePicks');
  const picks = intakeServicePicks(draft.imported, draft.edits);
  const paths = copyRisks(effective, presetFor(draft.vertical), picks).presetCopy.map((r) => r.path);
  assert.deepEqual(paths.filter((p) => p.startsWith('services.')), []);
  assert.deepEqual(paths, ['hero.placeholder'], 'only the hero placeholder is left once the sample jobs are gone');
});

test('a preset service the intake did not pick is still flagged', async () => {
  const { intakeServicePicks } = await import('../src/lib/copyRisks.ts');
  // A client whose intake listed no services: the preset's list falls through, and none of it was picked.
  const imported = clone(draft.imported);
  imported.services.items = [];
  const c = effectiveContent(draft.vertical, imported, null, {});
  const picks = intakeServicePicks(imported, {});
  const flagged = copyRisks(c, presetFor(draft.vertical), picks).presetCopy.map((r) => r.path);
  assert.ok(flagged.includes('services.items.0.t'), flagged.join(', '));
  assert.ok(flagged.includes('services.items.0.tag'), flagged.join(', '));
});

test('a picked name only excuses a name, and a picked tag only a tag', async () => {
  const { intakeServicePicks } = await import('../src/lib/copyRisks.ts');
  const preset = { services: { items: [{ t: 'Heating', tag: 'Heating', d: 'Sample description.' }] } };
  const content = { services: { items: [{ t: 'Heating', tag: 'Heating', d: 'Sample description.' }] } };
  const picks = intakeServicePicks({ services: { items: [{ t: 'Furnace work', tag: 'Heating' }] } }, {});
  const flagged = copyRisks(content, preset, picks).presetCopy.map((r) => r.path);
  assert.deepEqual(flagged, ['services.items.0.t', 'services.items.0.d']);
});

test("the Studio's SEO check and the export both score with the intake's picks", () => {
  assert.match(src('lib/scorePage.ts'), /copyRisks\(content, preset, opts\.servicePicks\)/);
  assert.match(src('app/api/build/export/route.ts'), /scoreSite\(c, seoPages, pages, \{[^\n]*\bservicePicks \}\)/);
  assert.match(src('components/wizard/IntakeStep.tsx'), /copyRisks\(effective, presetFor\(vertical\), servicePicks\)/);
  for (const dialog of ['LaunchDialog', 'DeployDialog']) {
    const s = src(`app/c/[slug]/build/${dialog}.tsx`);
    assert.match(s, /content: effective,\s*briefFacts,\s*servicePicks,/, `${dialog} posts servicePicks with the export`);
    assert.match(s, /<SeoCheckPanel [^>]*servicePicks=\{servicePicks\}/, `${dialog}'s SEO check scores with servicePicks`);
  }
});
