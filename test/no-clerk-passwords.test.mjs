/**
 * Nothing in jdd-ops sets or resets a Clerk password (operator rule, 2026-11-10).
 *
 * In Xander's words: "Onboarding shouldnt be setting or resetting a clerk password." Portal access
 * is by Clerk invitation only, never a temporary password.
 *
 * What shipped before: step 18 ("Portal test login") of every test-client run set the password of
 * the PORTAL_TEST_EMAIL account to PORTAL_TEST_PASSWORD. That account is Xander's own sign-in, so
 * any re-run of a test site would silently overwrite a password he had changed. It created the user
 * with a password when none existed, too.
 *
 * Source scans, so a revert fails in CI. Comment lines are skipped, so code that DOCUMENTS the old
 * behaviour doesn't trip them.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.next', 'test', 'fixtures', 'clients', 'deprecated', '.git', '.claude', 'template']);

function* sources(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* sources(p);
    else if (/\.(m?js|ts|tsx)$/.test(name)) yield p;
  }
}

const code = (file) =>
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');

const FILES = [...sources(ROOT)].map((f) => ({ f: path.relative(ROOT, f), src: code(f) }));

test('the scan covers onboard.js, lib/, scripts/ and the console', () => {
  const names = FILES.map((x) => x.f.replace(/\\/g, '/'));
  for (const must of ['onboard.js', 'lib/account-store.js', 'console/src/lib/reconcile.ts']) {
    assert.ok(names.includes(must), `${must} was not scanned`);
  }
  assert.ok(names.some((n) => n.startsWith('scripts/')));
});

test('no code passes a password to Clerk', () => {
  for (const { f, src } of FILES) {
    assert.doesNotMatch(src, /skipPasswordChecks/, `${f} skips Clerk's password checks, so it is setting one`);
    assert.doesNotMatch(
      src,
      /users\.(createUser|updateUser)\([^;]*\bpassword\s*:/s,
      `${f} creates or updates a Clerk user with a password`,
    );
  }
});

test('no code creates a Clerk user: access is by invitation only', () => {
  for (const { f, src } of FILES) assert.doesNotMatch(src, /users\.createUser\(/, `${f} creates a Clerk user`);
});

test('PORTAL_TEST_PASSWORD is read by nothing', () => {
  for (const { f, src } of FILES) assert.doesNotMatch(src, /PORTAL_TEST_PASSWORD/, `${f} still reads PORTAL_TEST_PASSWORD`);
});
