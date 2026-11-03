/**
 * A re-run must not leave production serving the env from before the run.
 *
 * Shipped and found 2026-11-03: re-running onboard.js for `_e2e_test_starter` migrated it to
 * portal lead delivery, but its live contact form returned 502 "Delivery failed" on every post.
 * Step 8's push made Vercel start a production build at once; step 9 wrote the new env
 * afterwards; Vercel snapshots env when a deployment is created. The build was created 36ms
 * before the first key and 760ms before `LEAD_INGEST_URL`. The preview deploy got the new env,
 * production never did, and nothing reported it.
 *
 * The fixture is that incident, recorded from the live API.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { productionPredatesEnv } from '../lib/vercel-sync.js';

const FIX = JSON.parse(
  readFileSync(new URL('./fixtures/vercel/stale-production-race.json', import.meta.url), 'utf8'),
);

/** Same normalization listDeployments applies to a v6 row. */
const normalize = (d) => ({ id: d.uid, createdAt: d.created ?? null });

const [fixed, stale, older] = FIX.deployments.deployments.map(normalize);
const lastWrite = Math.max(...FIX.envWrites.map((e) => e.updatedAt));
// onboard.js takes its timestamp after syncEnvToVercel returns, i.e. no earlier than this.
const envWrittenAt = lastWrite;

test('the push-triggered build that raced the env write is stale', () => {
  const firstWrite = Math.min(...FIX.envWrites.map((e) => e.updatedAt));
  assert.ok(stale.createdAt < firstWrite, 'fixture no longer shows the race');
  assert.equal(productionPredatesEnv(stale, envWrittenAt), true);
});

test('a deployment created after the env write is not rebuilt again', () => {
  assert.equal(productionPredatesEnv(fixed, envWrittenAt), false);
});

test('an older production build is stale too', () => {
  assert.equal(productionPredatesEnv(older, envWrittenAt), true);
});

test('no deployment, or one without a timestamp, is never "stale"', () => {
  // A brand-new client has no production deployment: nothing to rebuild, preview stays first.
  assert.equal(productionPredatesEnv(undefined, envWrittenAt), false);
  assert.equal(productionPredatesEnv({ createdAt: null }, envWrittenAt), false);
});

test('onboard.js checks production after writing env, before the preview deploy', () => {
  const src = readFileSync(new URL('../onboard.js', import.meta.url), 'utf8');
  const start = src.indexOf('async function syncVercelEnv(');
  const body = src.slice(start, src.indexOf('\n}', start));
  const sync = body.indexOf('await syncEnvToVercel(');
  const check = body.indexOf('await redeployProductionIfStale(');
  const preview = body.indexOf('await triggerPreviewDeploy(');
  assert.ok(sync > 0 && check > 0 && preview > 0, 'expected all three calls in syncVercelEnv');
  assert.ok(sync < check, 'production must be checked AFTER env is written, or it checks nothing');
  assert.ok(check < preview);
});

// ─── the preview deploy that should have been the safety net ───────────────────
//
// Same run: onboard.js's step-9 preview deploy failed with "gitSource missing repoId", because
// it sent `repo: "Org/slug"`. Vercel wants owner and repo as separate fields; that shape was
// checked against the live API (200, preview created) before this test was written.

import { githubGitSource } from '../lib/vercel-sync.js';

test('gitSource carries owner and repo separately, never "Org/slug"', () => {
  const src = githubGitSource('JuneauDigitalDesigns', '_e2e_test_starter');
  assert.deepEqual(src, { type: 'github', org: 'JuneauDigitalDesigns', repo: '_e2e_test_starter', ref: 'main' });
  assert.ok(!src.repo.includes('/'));
});

test('both deploy paths build gitSource through githubGitSource', () => {
  const lib = readFileSync(new URL('../lib/vercel-sync.js', import.meta.url), 'utf8');
  const code = lib.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  // Only deploy sources: project creation's `gitRepository` legitimately takes "Org/slug".
  assert.doesNotMatch(code, /gitSource:\s*\{/, 'a deploy path builds gitSource inline again');
  assert.equal((code.match(/gitSource:\s*githubGitSource\(/g) ?? []).length, 2);
});
