#!/usr/bin/env node
/**
 * scripts/record-dry-runs.js — capture onboard.js dry-run stdout for each client shape.
 *
 * These recordings are what console/test/phase-contract.test.mjs replays through the real
 * parser to prove run-plan.ts still agrees with onboard.js's `log()` calls. run-plan.ts's own
 * header names "the dry-run checkpoint across all three plans" as its guard against drift —
 * this is that checkpoint, written down instead of performed by hand.
 *
 * A dry run creates nothing, so this is safe to run any time. It needs no credentials: with
 * none present the vendor-facing checks report `?` and the phase SEQUENCE — the only thing the
 * contract test reads — is unchanged.
 *
 * Usage:
 *   npm run fixtures:dry-run
 *   npm run fixtures:dry-run -- --check   # exit 1 if a recording changed
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'test', 'fixtures', 'dry-run');
const CHECK_ONLY = process.argv.includes('--check');

/**
 * Every shape is recorded from a SELF-CONTAINED fixture intake, never from a real client.
 *
 * These were originally captured against clients/_e2e_test_*, which made them depend on those
 * clients' .env.local: the logs printed "Reusing existing agent / number / base", so clearing
 * one key rewrote the recordings and the phase contract churned for reasons unrelated to any
 * phase changing. A contract test that moves on unrelated state is one people learn to skip.
 *
 * The starter intake is recorded twice because `--receptionist` overrides the mode in the file:
 * the with-receptionist and web-only shapes differ ONLY in that flag, which is exactly the
 * distinction worth pinning.
 */
const SHAPES = [
  { file: 'growth.log', schema: 'test/fixtures/intake/fixture-growth/site.ts', receptionist: 'forwarded' },
  { file: 'starter.log', schema: 'test/fixtures/intake/fixture-starter/site.ts', receptionist: 'forwarded' },
  { file: 'web-only.log', schema: 'test/fixtures/intake/fixture-starter/site.ts', receptionist: 'declined' },
  { file: 'enterprise.log', schema: 'test/fixtures/intake/fixture-enterprise/site.ts', receptionist: 'forwarded' },
];

/**
 * Remove everything that differs between two identical runs, so a diff means a real change.
 * Absolute paths, durations and ids would otherwise churn the fixture on every capture.
 */
function normalize(out) {
  return out
    .split(/\r?\n/)
    .filter((l) => !/DeprecationWarning|trace-deprecation|^\(node:\d+\)/.test(l))
    // The Twilio account-status pre-flight reports LIVE account state, which is not phase data
    // and changes when billing changes. Leaving it in would churn these recordings — and
    // therefore the phase contract — every time the account's status moved, for a reason that
    // has nothing to do with the phases being contracted.
    .filter((l) => !/Twilio (account|rejected the master credentials)/.test(l))
    .filter((l) => !/^\s+If (that|it) says/.test(l))
    .map((l) =>
      l
        .replaceAll(ROOT, '<ROOT>')
        .replace(/\\/g, '/')
        .replace(/\b\d+(\.\d+)?\s?ms\b/g, '<MS>')
        .replace(/agent_[a-z0-9]+/gi, 'agent_<ID>')
        .replace(/app[A-Za-z0-9]{14,}/g, 'app<ID>')
        // Twilio Account SID. Not a secret (it is the public half of the pair) but there is no
        // reason to commit it, and it would churn if the master account ever changed.
        .replace(/AC[0-9a-f]{30,}/g, 'AC<SID>')
        .replace(/\+\d{10,}/g, '<E164>')
        .replace(/\(\d{3}\) \d{3}-\d{4}/g, '<PHONE>'),
    )
    .join('\n')
    .trimEnd() + '\n';
}

let changed = 0;
let absent = 0;
mkdirSync(OUT, { recursive: true });

for (const shape of SHAPES) {
  let stdout;
  try {
    stdout = execFileSync(
      process.execPath,
      ['onboard.js', '--schema', shape.schema, '--dry-run', '--receptionist', shape.receptionist],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (err) {
    // A dry run that exits non-zero is itself a finding worth failing on.
    console.error(`✗ ${shape.file}: dry run exited ${err.status}`);
    console.error((err.stdout ?? '') + (err.stderr ?? ''));
    process.exit(1);
  }

  const next = normalize(stdout);
  const full = resolve(OUT, shape.file);
  const prev = existsSync(full) ? readFileSync(full, 'utf8') : null;
  if (prev === next) {
    console.log(`  = ${shape.file}`);
    continue;
  }
  if (prev === null) absent++;
  else changed++;
  if (CHECK_ONLY) {
    // A recording that is ABSENT and one that DRIFTED are different findings, and conflating
    // them cost real time: the recordings were caught by `.gitignore`'s `*.log`, so CI had none
    // and reported all four as "phase output drifted" on every run. That reads as a code
    // regression in onboard.js, which is exactly where you then go looking.
    console.error(
      prev === null
        ? `  ! ${shape.file} MISSING — nothing to compare against. These are tracked; check .gitignore`
        : `  ! ${shape.file} WOULD CHANGE — onboard.js's phase output drifted`,
    );
    continue;
  }
  writeFileSync(full, next, 'utf8');
  console.log(`  ${prev ? '~' : '+'} ${shape.file}`);
}

if (CHECK_ONLY && (changed || absent)) {
  if (absent) {
    console.error(`\n✗ ${absent} recording(s) MISSING — the phase contract has nothing to check.`);
    console.error('  They are tracked on purpose; if git is not showing them, check .gitignore.');
  }
  if (changed) {
    console.error(`\n✗ ${changed} recording(s) drifted. Re-run \`npm run fixtures:dry-run\`, then`);
    console.error('  update PHASE_MAP / expectedPhases in the same commit if phases changed.');
  }
  process.exit(1);
}
console.log(changed ? `\n✓ ${changed} recording(s) updated — review the diff.` : '\n✓ All recordings current.');
