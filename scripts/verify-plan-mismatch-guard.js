#!/usr/bin/env node
/**
 * scripts/verify-plan-mismatch-guard.js — regression check for the §2 plan-consistency guard
 * in onboard.js's validateIntake (PLAN-tier-form-wiring-ops.md §5).
 *
 * Builds synthetic INTAKE-shape schema fixtures under a scratch temp dir and runs the real
 * onboard.js CLI against them as a child process (black-box: onboard.js has no exports to
 * import — `main()` runs unconditionally at module load). Four scenarios:
 *
 *   A. mismatched plan, --dry-run, no flag           → must hard-fail with the §2.1 message
 *   B. mismatched plan, --dry-run, +flag              → must simulate the rewrite and complete
 *   C. mismatched plan + a deliberately-missing field, NOT dry-run, +flag
 *        → must still fail overall (the unrelated missing field), but must have ACTUALLY
 *          rewritten _meta.selectedPlan on disk and dropped the plan-mismatch error — the one
 *          path that only a real (non-dry-run) invocation exercises. Safe to run for real: the
 *          deliberate missing field makes validateIntake fail before preflight/credential
 *          checks, so no live Twilio/Retell/GitHub call is ever reached.
 *   D. matching plan, --dry-run, no flag              → must pass unchanged (regression guard)
 *
 * Writes only inside its own temp dir. Never touches clients/ or any real credential.
 * Usage: node scripts/verify-plan-mismatch-guard.js
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ONBOARD = join(ROOT, 'onboard.js');

function siteObj(selectedPlan, { missingAddress = false } = {}) {
  return {
    brand: {
      name: 'Guard Test Co',
      short: 'Guard Test Co',
      long: 'Guard Test Co LLC',
      established: null,
      tagline: 'x',
      phone: '(555) 555-0100',
      phoneHref: 'tel:+15555550100',
      email: 'test@example.com',
      address: missingAddress ? '' : '1 Test St',
      license: null,
      palette: { accent: '#000', bg: '#fff', bgSoft: '#eee', ink: '#000', inkSoft: '#333', rule: '#ccc' },
      typography: { fontSans: 'sans', fontHeading: 'sans', headingWeight: 700, bodyWeight: 400 },
    },
    services: { items: [] },
    faq: { items: [] },
    seo: { title: 'x', description: 'x', canonical: 'https://example.com' },
    _meta: { selectedPlan },
  };
}

// .mjs, not .js: the fixture lives in an OS temp dir with no package.json declaring
// "type": "module", and onboard.js's loadIntake imports non-.ts schemas via a plain
// `import(fileUrl)` whose module type Node infers from the file's own extension/ancestry —
// a bare .js there would resolve as CommonJS and reject the `export` syntax.
function writeFixture(dir, name, envelopePlan, sitePlan, opts = {}) {
  const intake = {
    plan: envelopePlan,
    receptionistMode: 'forwarded',
    siteCount: 1,
    sites: [siteObj(sitePlan, opts)],
  };
  const path = join(dir, name);
  writeFileSync(path, `export const INTAKE = ${JSON.stringify(intake, null, 2)};\n`, 'utf8');
  return path;
}

function run(args) {
  try {
    const stdout = execFileSync('node', [ONBOARD, ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

function assert(cond, label) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`  ok - ${label}`);
}

const dir = mkdtempSync(join(tmpdir(), 'jdd-plan-guard-'));
let failures = 0;

try {
  console.log('[A] mismatched plan, --dry-run, no flag → must hard-fail');
  {
    const fx = writeFixture(dir, 'a.mjs', 'growth', 'starter');
    const res = run(['--schema', fx, '--dry-run']);
    try {
      assert(res.status !== 0, 'exits non-zero');
      assert(res.stderr.includes('was built for plan "starter"'), 'message names the site plan');
      assert(res.stderr.includes('provisions "growth"'), 'message names the envelope plan');
    } catch (e) {
      failures++;
      console.error(e.message);
      console.error('  --- stderr ---\n' + res.stderr);
    }
  }

  console.log('[B] mismatched plan, --dry-run, +flag → must simulate rewrite and complete');
  {
    const fx = writeFixture(dir, 'b.mjs', 'growth', 'starter');
    const res = run(['--schema', fx, '--dry-run', '--reexport-on-plan-mismatch']);
    try {
      assert(res.status === 0, 'exits zero');
      assert(res.stdout.includes('would rewrite site[0]') || res.stderr.includes('would rewrite site[0]'), 'logs the simulated rewrite');
      assert(!res.stderr.includes('was built for plan'), 'does not hard-fail');
      assert(res.stdout.includes('DRY RUN COMPLETE'), 'dry run completes');
    } catch (e) {
      failures++;
      console.error(e.message);
      console.error('  --- stdout ---\n' + res.stdout + '\n  --- stderr ---\n' + res.stderr);
    }
  }

  console.log('[C] mismatched plan + missing field, REAL run, +flag → rewrites on disk, still fails (unrelated field), never reaches preflight');
  {
    const fx = writeFixture(dir, 'c.mjs', 'growth', 'starter', { missingAddress: true });
    const res = run(['--schema', fx, '--reexport-on-plan-mismatch']);
    try {
      assert(res.status !== 0, 'exits non-zero (missing brand.address)');
      assert(res.stderr.includes('missing required field brand.address'), 'fails on the unrelated missing field');
      assert(!res.stderr.includes('was built for plan'), 'plan-mismatch error is gone (rewrite absorbed it)');
      assert(!res.stdout.includes('[pre-flight]'), 'never reached preflight — no live credential/API call was made');
      const onDisk = readFileSync(fx, 'utf8');
      assert(onDisk.includes('"selectedPlan": "growth"'), 'file on disk was actually rewritten to the envelope plan');
      assert(!onDisk.includes('"selectedPlan": "starter"'), 'old value no longer present');
    } catch (e) {
      failures++;
      console.error(e.message);
      console.error('  --- stdout ---\n' + res.stdout + '\n  --- stderr ---\n' + res.stderr);
    }
  }

  console.log('[D] matching plan, --dry-run, no flag → passes unchanged');
  {
    const fx = writeFixture(dir, 'd.mjs', 'growth', 'growth');
    const res = run(['--schema', fx, '--dry-run']);
    try {
      assert(res.status === 0, 'exits zero');
      assert(!res.stderr.includes('was built for plan'), 'no plan-mismatch error');
      assert(res.stdout.includes('DRY RUN COMPLETE'), 'dry run completes');
    } catch (e) {
      failures++;
      console.error(e.message);
      console.error('  --- stdout ---\n' + res.stdout + '\n  --- stderr ---\n' + res.stderr);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n${failures} scenario(s) failed.`);
  process.exit(1);
}
console.log('\nAll plan-mismatch guard scenarios passed.');
