// The SEO check's "number not in the client's facts" rule, against Xander's real draft for
// clients/_e2e_test_growth (2026-11-11, copied unscrubbed: it is a test client).
//
// He ran intake, then copy generation, then Export, and got 16 blocking findings, all false:
//   - "$50" in ten fields. The operator's promotion, "$50 off your first service", lives in the
//     copy brief (brief.blocks.offers.overrides.promo). The model was told it and used it; the
//     check read only the site content, so it refused every use.
//   - "2026", "28", "09", "14" in review dates and "12" ("installed by 12pm") in a review quote.
//     Reviews are the client's customers' own words, never the model's.
// The fix counts what the brief gave the copywriter (copy-brief/brief-facts.ts) as fact, and skips
// review items. Neither may open a hole: a number neither source states, and a model-written field
// repeating a review's number, are still refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { effectiveContent } from '../src/lib/effectiveContent.ts';
import { seoFindings } from '../src/app/c/[slug]/build/seo-findings.ts';
import { studioBriefFacts } from '../src/lib/copy-brief/brief-facts.ts';

const draft = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/drafts/e2e-test-growth-2026-11-11.json', import.meta.url)), 'utf8'));
const effective = effectiveContent(draft.vertical, draft.imported, draft.generated, draft.edits);
const briefFacts = studioBriefFacts({ vertical: draft.vertical, effective, imported: draft.imported, edits: draft.edits, brief: draft.brief });
const score = (content, facts = briefFacts) => seoFindings(content, draft.siteComposition, draft.vertical, facts);
const clone = (v) => JSON.parse(JSON.stringify(v));

test('the fixture is the draft that was refused: its promotion is in the brief, not the content', () => {
  assert.equal(draft.brief.blocks.offers.overrides.promo, '$50 off your first service');
  assert.ok(score(effective, '').hard.some((h) => h.startsWith('Number "$50" in finalCta.headline ')), 'without the brief the $50 is refused');
});

test("the operator's promotion is a client fact: no \"$50\" finding anywhere", () => {
  const dollars = score(effective).hard.filter((h) => h.includes('"$50"'));
  assert.deepEqual(dollars, []);
});

test('review dates and review quotes are not checked for numbers', () => {
  const reviews = score(effective).hard.filter((h) => / in testimonials\.items\.\d+\./.test(h));
  assert.deepEqual(reviews, []);
});

test('the refused draft now has nothing blocking', () => {
  assert.deepEqual(score(effective).hard, []);
});

test('the brief facts are what the copywriter was told, promotion included, and no instruction', () => {
  assert.match(briefFacts, /Current promotion: \$50 off your first service\./);
  // Counts and lengths are layout: "Keep these exact counts" must never whitelist a number.
  assert.doesNotMatch(briefFacts, /exact counts|Write brand copy for ONLY/);
});

test('a number neither the content nor the brief states is still refused', () => {
  const c = clone(effective);
  c.finalCta.headline = 'Save $75 on your first service';
  assert.ok(score(c).hard.some((h) => h.startsWith('Number "$75" in finalCta.headline ')), score(c).hard.join('\n'));
});

test("a model-written field repeating a review's number is still refused", () => {
  assert.match(effective.testimonials.items[1].q, /by 12pm/);
  const c = clone(effective);
  c.about.story[0] = 'Most furnaces we install are running by 12pm.';
  assert.ok(score(c).hard.some((h) => h.startsWith('Number "12" in about.story.0 ')), score(c).hard.join('\n'));
});

test('the export scores with the brief facts the Studio posts', () => {
  const route = readFileSync(fileURLToPath(new URL('../src/app/api/build/export/route.ts', import.meta.url)), 'utf8');
  assert.match(route, /scoreSite\(c, seoPages, pages, \{.*\bbriefFacts\b.*\}\)/);
  for (const dialog of ['LaunchDialog', 'DeployDialog']) {
    const src = readFileSync(fileURLToPath(new URL(`../src/app/c/[slug]/build/${dialog}.tsx`, import.meta.url)), 'utf8');
    assert.match(src, /content: effective,\s*briefFacts,/, `${dialog} posts briefFacts with the export`);
    assert.match(src, /<SeoCheckPanel [^>]*briefFacts=\{briefFacts\}/, `${dialog}'s SEO check scores with briefFacts`);
  }
});
