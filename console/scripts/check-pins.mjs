#!/usr/bin/env node
/**
 * Fail when the three consumers of @jdd/schema don't pin the same version.
 *
 * Why this exists: the agency site reads portal account records through
 * `zPortalAccount.safeParse(raw)` and returns `parsed.data`. Zod strips unknown keys by
 * default, so any field outside the *reader's* pinned schema is silently deleted on read —
 * no error, no warning, just a field that stops existing. A version lag is therefore not a
 * cosmetic inconsistency, it is silent data loss whose direction depends on which app reads
 * the record last.
 *
 * That has already bitten once: the portal sat on v1.11.0 while the console and jdd-ops sat
 * on v1.9.0, which meant `retellAgentId` (added in v1.10.0, and the join key minute-billing
 * uses) did not exist in the console's vocabulary at all. The console could not see, verify,
 * or repair the field its own overage billing joins on.
 *
 * Usage:
 *   node scripts/check-pins.mjs        # exit 1 if the pins diverge, or an install is stale
 *
 * Checks the declared pin AND the installed tree, because the pin alone gives false
 * confidence. Bumping package.json to v1.11.0 and running `npm install` left both repos
 * still on 1.9.0: the lockfile had the old tag resolved to a commit sha, and npm honoured
 * the lock rather than re-reading the tag. package.json said v1.11.0, node_modules said
 * 1.9.0, and `retellAgentId` was still missing. Only an explicit
 * `npm install github:…/jdd-schema#vX.Y.Z` rewrites the resolved sha.
 *
 * So a green pin check that never opened node_modules would have certified exactly the
 * state it exists to catch.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const consoleRoot = resolve(scriptDir, '..'); // …/ops/jdd-ops/console
const opsRepo = resolve(consoleRoot, '..'); //    …/ops/jdd-ops
const opsDir = resolve(opsRepo, '..'); //         …/ops

const DEP = '@jdd/schema';

const CONSUMERS = [
  { label: 'console', root: consoleRoot },
  { label: 'jdd-ops', root: opsRepo },
  { label: 'agency', root: resolve(opsDir, 'juneau-digital-designs') },
].map((c) => ({
  ...c,
  file: resolve(c.root, 'package.json'),
  installed: resolve(c.root, 'node_modules', '@jdd', 'schema', 'package.json'),
}));

/** The version actually on disk, or null if the package isn't installed here. */
function installedVersion(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

/** Trailing `#vX.Y.Z` of a github: spec, so the pin can be compared to what npm unpacked. */
function pinnedVersion(pin) {
  const m = /#v?(\d+\.\d+\.\d+)$/.exec(pin);
  return m ? m[1] : null;
}

/**
 * A missing consumer is a hard failure, not a skip. Silently passing because a path moved is
 * exactly how the script this replaced went unnoticed for months.
 */
let missing = 0;
const pins = [];

for (const { label, file, installed } of CONSUMERS) {
  if (!existsSync(file)) {
    console.error(`✖ ${label}: no package.json at ${file}`);
    missing++;
    continue;
  }

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`✖ ${label}: unreadable package.json — ${err.message}`);
    missing++;
    continue;
  }

  const pin = pkg.dependencies?.[DEP] ?? pkg.devDependencies?.[DEP] ?? null;
  if (!pin) {
    console.error(`✖ ${label}: does not depend on ${DEP}`);
    missing++;
    continue;
  }

  pins.push({ label, pin, installed: installedVersion(installed) });
}

if (missing > 0) process.exit(1);

const distinct = [...new Set(pins.map((p) => p.pin))];

// A pin the installed tree doesn't match. `installed: null` means not installed here at all,
// which is normal for a repo nobody has run `npm install` in yet — report it, don't fail on it.
const stale = pins.filter(
  (p) => p.installed && pinnedVersion(p.pin) && p.installed !== pinnedVersion(p.pin),
);

for (const { label, pin, installed } of pins) {
  const ok = distinct.length === 1 && !stale.some((s) => s.label === label);
  const note = installed ? `(installed ${installed})` : '(not installed)';
  console.log(`${ok ? '✓' : '·'} ${label.padEnd(8)} ${pin}  ${note}`);
}

if (distinct.length > 1) {
  console.error(
    `\n✖ ${DEP} pins diverge across ${pins.length} consumers.\n` +
      `  Zod strips unknown keys on read, so the app on the older pin will silently\n` +
      `  delete fields the newer one wrote. Align all three, then reinstall.`,
  );
  process.exit(1);
}

if (stale.length > 0) {
  console.error(
    `\n✖ ${stale.length} install(s) don't match the pin:\n` +
      stale.map((s) => `    ${s.label}: pinned ${pinnedVersion(s.pin)}, installed ${s.installed}`).join('\n') +
      `\n\n  A plain \`npm install\` will NOT fix this — the lockfile has the old tag already\n` +
      `  resolved to a commit sha and npm honours the lock. Force re-resolution:\n` +
      `    npm install "${distinct[0]}"`,
  );
  process.exit(1);
}

console.log(`\n${DEP} pinned and installed consistently at ${distinct[0]}.`);
