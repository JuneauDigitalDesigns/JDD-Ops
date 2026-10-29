/**
 * The phase contract between onboard.js and the /onboard UI.
 *
 * run-plan.ts opens with this warning:
 *
 *   ⚠ THIS FILE MIRRORS onboard.js's main loop. If you add, remove, or reorder a log(N, …)
 *   call in onboard.js, update expectedPhases() in the same commit. … ORDER and GATING are
 *   only correct if a human keeps them correct. The dry-run checkpoint across all three plans
 *   is the guard.
 *
 * That guard was entirely manual, and it had already failed twice: a `log()` call reading
 * "Publish Twilio number on the site" was folded into the purchase phase by PHASE_MAP's
 * /Twilio number/i (so the UI showed "Phone number" twice and the publish step had no node),
 * and "Portal test login" matched no entry at all, rendering as an `unplanned` node on every
 * run since it was added.
 *
 * Drift here doesn't break provisioning — it breaks the UI's ACCOUNT of provisioning, which is
 * how an operator decides whether a run went well. This test replays recorded dry-run stdout
 * through the real parser and asserts the phases line up with the real plan.
 *
 * Lives in console/test/ because it imports the TypeScript parser and planner (tsx is wired up
 * here); the fixtures it reads are captured in the jdd-ops root.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRun } from '../src/lib/onboard-parse.ts';
import { expectedPhases } from '../src/lib/run-plan.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '..', '..', 'test', 'fixtures', 'dry-run');

/** The four client shapes, and the recorded stdout + plan context for each. */
const SHAPES = [
  { file: 'growth.log', plan: 'growth', isEnterprise: false, isWebOnly: false, sites: 1 },
  { file: 'starter.log', plan: 'starter', isEnterprise: false, isWebOnly: false, sites: 1 },
  { file: 'web-only.log', plan: 'starter', isEnterprise: false, isWebOnly: true, sites: 1 },
  { file: 'enterprise.log', plan: 'enterprise', isEnterprise: true, isWebOnly: false, sites: 2 },
];

function ctxFor(shape) {
  return {
    slug: 'fixture',
    plan: shape.plan,
    brandName: 'Fixture Co',
    isEnterprise: shape.isEnterprise,
    repoBuilt: true,
    detectedStatus: 'ready',
    schemaPath: 'clients/fixture/site.ts',
    hasIntake: true,
    isWebOnly: shape.isWebOnly,
    receptionistMode: shape.isWebOnly ? 'declined' : 'forwarded',
    sites: Array.from({ length: shape.sites }, (_, i) => ({
      slug: shape.sites > 1 ? `fixture-${i + 1}` : 'fixture',
      brandName: `Fixture ${i + 1}`,
    })),
  };
}

for (const shape of SHAPES) {
  const path = resolve(FIXTURES, shape.file);

  test(`${shape.file}: every emitted phase is one the plan predicted`, (t) => {
    if (!existsSync(path)) {
      t.skip(`missing fixture ${shape.file} — regenerate with npm run fixtures:dry-run`);
      return;
    }
    const run = parseRun(readFileSync(path, 'utf8').split(/\r?\n/));
    const planned = new Set(expectedPhases(ctxFor(shape)).map((p) => p.key));
    const unplanned = run.phases.map((p) => p.key).filter((k) => !planned.has(k));
    assert.deepEqual(
      unplanned,
      [],
      'these phases were logged but PHASE_MAP/expectedPhases do not know them, so they render as unplanned',
    );
  });

  test(`${shape.file}: no phase is emitted twice under one key`, (t) => {
    if (!existsSync(path)) {
      t.skip('missing fixture');
      return;
    }
    const run = parseRun(readFileSync(path, 'utf8').split(/\r?\n/));
    const keys = run.phases.map((p) => p.key);
    assert.deepEqual([...new Set(keys)], keys, 'a duplicate key means two log() messages collapsed into one phase');
  });

  test(`${shape.file}: the voice stack is gated on web-only, not on plan`, (t) => {
    if (!existsSync(path)) {
      t.skip('missing fixture');
      return;
    }
    const run = parseRun(readFileSync(path, 'utf8').split(/\r?\n/));
    const keys = run.phases.map((p) => p.key);
    const voice = ['Phone number', 'Retell agent', 'Call logging', 'Publish number'];
    for (const v of voice) {
      const emitted = keys.some((k) => k.startsWith(v));
      assert.equal(
        emitted,
        !shape.isWebOnly,
        `${v} should ${shape.isWebOnly ? 'NOT ' : ''}run for ${shape.plan}${shape.isWebOnly ? ' web-only' : ''}`,
      );
    }
  });

  test(`${shape.file}: the correctness checks run for every client`, (t) => {
    if (!existsSync(path)) {
      t.skip('missing fixture');
      return;
    }
    const run = parseRun(readFileSync(path, 'utf8').split(/\r?\n/));
    // A web-only client still has a tier matrix to get wrong, so this is never gated.
    assert.ok(
      run.phases.some((p) => p.key.startsWith('Correctness checks')),
      'a dry run must report whether it would provision CORRECTLY, not just that it would run',
    );
  });

  test(`${shape.file}: the dry run is recognized as a dry run`, (t) => {
    if (!existsSync(path)) {
      t.skip('missing fixture');
      return;
    }
    const run = parseRun(readFileSync(path, 'utf8').split(/\r?\n/));
    assert.equal(run.dryRun, true, 'the banner must keep its "=== DRY RUN MODE" prefix');
    assert.equal(run.failed, undefined, 'a clean dry run must not parse as a failed run');
  });
}

test('the publish step no longer collides with the purchase step', () => {
  // Direct regression test for the collision, independent of the recorded fixtures.
  const run = parseRun([
    '[step 9] Provision JDD Twilio number (human-first routing → Retell fallback)',
    '[step 12] Publish number on the site (was (207) 318-1838)',
  ]);
  const keys = run.phases.map((p) => p.key);
  assert.equal(keys.length, 2, 'these are two distinct phases, not one phase entered twice');
  assert.deepEqual(keys, ['Phone number', 'Publish number']);
});

test('a soft check failure is not misread as a fatal run failure', () => {
  // reduceRun treats any line containing `FAIL:` as fatal, so check output must avoid it.
  const run = parseRun([
    '[step 13] Correctness checks',
    '  ✗ airtable.notMasterBase — client AIRTABLE_BASE_ID is the master base appX',
    '  8 passed, 1 failed, 0 not checked',
  ]);
  assert.equal(run.failed, undefined, 'a failing check must not abort the UI run narration');
});
