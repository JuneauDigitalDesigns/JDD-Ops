#!/usr/bin/env node
// @ts-check
/**
 * Print the A2P Phase 0 readiness report.
 *
 *   node scripts/a2p-readiness.js
 *
 * Read-only: it creates, updates and deletes nothing. Safe to run against the live account at
 * any time, which is the point — Phase 0 is the kind of state that silently stops being true.
 *
 * Loads `.env` with `override: true`, exactly as `onboard.js` does, so this reports on the same
 * environment a real run would see. Note that means **`.env.local` is not read** — a value that
 * only exists there is invisible to onboard.js too, and this script showing it missing is the
 * correct answer rather than a limitation.
 */

import dotenv from 'dotenv';
import { checkA2pReadiness } from '../lib/a2p-readiness.js';

dotenv.config({ override: true });

const mark = (/** @type {true | false | null} */ ok) => (ok === true ? '✓' : ok === false ? '✕' : '?');

const report = await checkA2pReadiness();

console.log('\nA2P Phase 0 readiness\n');
for (const check of report.checks) {
  console.log(`  ${mark(check.ok)} ${check.label}`);
  console.log(`      ${check.detail}`);
  if (check.fix) console.log(`      → ${check.fix}`);
}

if (Object.keys(report.policies).length) {
  console.log('\n  Policy SIDs discovered:');
  for (const [name, sid] of Object.entries(report.policies)) {
    console.log(`      ${name} = ${sid}`);
  }
}

if (report.profileCandidates.length) {
  console.log('\n  Customer profiles on this account:');
  for (const p of report.profileCandidates) {
    console.log(`      ${p.sid}  ${p.status.padEnd(16)}  ${p.friendlyName}`);
  }
}

console.log(
  `\n  Overall: ${
    report.ok === true
      ? 'READY — per-client registration is unblocked.'
      : report.ok === false
        ? 'NOT READY — per-client registration is blocked.'
        : 'UNKNOWN — something could not be checked, which is not a pass.'
  }\n`,
);

// Non-zero on anything but a clean pass, so this is usable as a pre-flight in a script.
process.exit(report.ok === true ? 0 : 1);
