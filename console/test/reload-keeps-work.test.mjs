// Xander, 2026-11-12: "the business facts are not being saved on a reload. And copy generation is
// also not being saved if you get to the studio step and you haven't exported the project yet."
//
// Both had one cause. A client onboard.js provisioned has a repo whose page.tsx the studio can
// read back, so hydration took the "already exported: disk wins" path on EVERY reload and opened
// with `edits: {}` and `generated: null`. The Business step's facts are edits; a copy run is the
// generated layer. Both were saved (localStorage and .draft.json) and both were thrown away on the
// next load. _e2e_test_growth's .draft.json on 2026-11-12 holds exactly that aftermath: generated
// null, edits only the template's palette and type, saved after a reload.
//
// The fix: the repo wins only over work saved BEFORE it was last written. A draft saved after it
// is newer work and opens as it was saved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startingBundle } from '../src/lib/wizardBundle.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The repo's page.tsx as onboard.js left it (_e2e_test_growth: 2026-11-11 20:36 local).
const REPO_WRITTEN = Date.parse('2026-11-12T01:36:00Z');

test('fill the business facts, reload: the facts are kept (repo from onboarding, never exported here)', () => {
  const afterTyping = {
    savedAt: REPO_WRITTEN + 60 * 60_000,
    edits: { 'brand.palette': {}, 'brand.typography': {}, 'brand.phone': '(407) 555-0142', 'extensions.ownerName': 'Dana Ruiz' },
    generated: null,
  };
  // Reload: this browser's copy and the server draft are the same save.
  const r = startingBundle({ saved: afterTyping, server: afterTyping, exported: true, exportedAt: REPO_WRITTEN });
  assert.equal(r.from, 'draft');
  assert.equal(r.bundle.edits['brand.phone'], '(407) 555-0142');
  assert.equal(r.bundle.edits['extensions.ownerName'], 'Dana Ruiz');
});

test('generate, open the Studio, reload with no export: the copy is kept', () => {
  const afterGenerate = {
    savedAt: REPO_WRITTEN + 2 * 60 * 60_000,
    edits: { 'brand.palette': {}, 'brand.typography': {} },
    generated: { hero: { headline: 'AC repair in Winter Park, with the price before we start.' }, faq: { items: [] } },
  };
  // Only the server draft (another browser, or cleared storage) still opens the copy.
  for (const [saved, server] of [[afterGenerate, afterGenerate], [null, afterGenerate], [afterGenerate, null]]) {
    const r = startingBundle({ saved, server, exported: true, exportedAt: REPO_WRITTEN });
    assert.equal(r.from, 'draft');
    assert.equal(r.bundle.generated.hero.headline, 'AC repair in Winter Park, with the price before we start.');
  }
});

test('a copy saved before the repo was last written still loses to the repo', () => {
  const stale = { savedAt: REPO_WRITTEN - 60_000, edits: { 'hero.headline': 'old' }, generated: { hero: {} } };
  assert.deepEqual(startingBundle({ saved: stale, server: null, exported: true, exportedAt: REPO_WRITTEN }), { from: 'disk', bundle: null });
  // An unstamped (pre-savedAt) bundle can't prove it is newer.
  assert.equal(startingBundle({ saved: { edits: {} }, server: null, exported: true, exportedAt: REPO_WRITTEN }).from, 'disk');
  // Exported with no known time: the repo wins, as before.
  assert.equal(startingBundle({ saved: { savedAt: Date.now() }, server: null, exported: true, exportedAt: null }).from, 'disk');
});

test('never exported: the newer saved copy, else a fresh start', () => {
  const a = { savedAt: 2 }, b = { savedAt: 3 };
  assert.deepEqual(startingBundle({ saved: a, server: b, exported: false, exportedAt: null }), { from: 'draft', bundle: b });
  assert.deepEqual(startingBundle({ saved: null, server: null, exported: false, exportedAt: null }), { from: 'fresh', bundle: null });
});

test('the wizard hydrates through startingBundle, and the page passes when the repo was written', () => {
  const wiz = readFileSync(path.join(ROOT, 'src/app/c/[slug]/build/BuildWizard.tsx'), 'utf8');
  assert.match(wiz, /startingBundle\(\{/);
  assert.doesNotMatch(wiz, /if \(manifest \|\| composition\) \{/);
  const page = readFileSync(path.join(ROOT, 'src/app/c/[slug]/build/page.tsx'), 'utf8');
  assert.match(page, /exportedAt=\{exportedAt\}/);
});
