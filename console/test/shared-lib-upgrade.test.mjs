/**
 * Bringing an older client repo up to the template from the console, without shipping a lead form
 * and an /api/contact route that disagree.
 *
 * What shipped: `_e2e_test_growth/repo` pins @jdd/ui v1.0.7 against the template's v1.4.0. Re-export
 * refused it ("bump @jdd/ui in the client repo's package.json…"), with no way to do that in the
 * console, and only AFTER it had already rewritten site.ts, page.tsx, src/lib and the contact route
 * in the repo. The route it wrote checks AI-call consent; the v1.0.7 form beside it never sends any.
 * Pushed as it stood, that site would never call a lead back, and nothing would say so.
 *
 * Two rules come out of it, both encoded here:
 *   1. The repo's @jdd/ui pin moves only when the export request confirms the exact update that
 *      is due, and an unconfirmed one stops before anything is written.
 *   2. Nothing is built, committed or pushed unless the INSTALLED form and the route agree.
 *
 * Imports sharedLibs.ts, never export.ts, for the reason export-guard.test.mjs gives.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkFormRoutePairing,
  checkRepoFormRoutePairing,
  confirmsUpgrade,
  decideUpgrade,
  planSharedLibUpgrade,
} from '../src/lib/sharedLibs.ts';
import * as uiPin from '../../lib/ui-pin.js';

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(CONSOLE, '..');
const PAIRING = path.join(CONSOLE, 'test/helpers/lib-fixtures/pairing');
const UI_SRC = path.join(CONSOLE, 'node_modules/@jdd/ui/src');

const spec = (v) => `github:JuneauDigitalDesigns/jdd-ui#${v}`;
const OLD = spec('v1.0.7');
const NEW = spec('v1.4.0');

const read = (p) => readFileSync(p, 'utf8');
const CURRENT_ROUTE = read(path.join(OPS, 'lib/site-routes/contact.route.ts'));
const PRE_CONSENT_ROUTE = read(path.join(PAIRING, 'contact.route.pre-consent.ts.txt'));
const CURRENT_CONSENT_TEXT = read(path.join(UI_SRC, 'lead-consent-text.ts'));
const CURRENT_FORM = read(path.join(UI_SRC, 'LeadForm.tsx'));
const OLD_FORM = read(path.join(PAIRING, 'LeadForm.v1.0.7.tsx.txt'));

function write(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** A throwaway ops root (template + lib/site-routes) and a client repo one release behind. */
function fixture() {
  const ops = mkdtempSync(path.join(tmpdir(), 'shared-libs-'));
  const tpl = path.join(ops, 'template');
  const repo = path.join(ops, 'clients/demo/repo');
  write(path.join(tpl, 'package.json'), JSON.stringify({ dependencies: { '@jdd/ui': NEW, lenis: '^1.1.18' } }));
  write(path.join(tpl, 'src/lib/motion.ts'), "export * from '@jdd/ui/motion';\n");
  write(path.join(tpl, 'src/lib/img.ts'), "export * from '@jdd/ui/img';\n");
  write(path.join(tpl, 'src/styles/globals.css'), 'body{}\n');
  write(path.join(tpl, 'src/data/site.ts'), 'export const CONTENT = {};\n');
  write(path.join(ops, 'lib/site-routes/contact.route.ts'), CURRENT_ROUTE);

  write(path.join(repo, 'package.json'), JSON.stringify({ dependencies: { '@jdd/ui': OLD } }));
  write(path.join(repo, 'package-lock.json'), '{}');
  write(path.join(repo, 'src/lib/motion.ts'), 'export const EASE = [0.2, 0, 0, 1];\n');
  write(path.join(repo, 'src/styles/globals.css'), 'body{}\n');
  write(path.join(repo, 'src/data/site.ts'), 'export const CONTENT = { brand: {} };\n');
  write(path.join(repo, 'src/app/api/contact/route.ts'), PRE_CONSENT_ROUTE);
  return { ops, repo, done: () => rmSync(ops, { recursive: true, force: true }) };
}

// ─── rule 1: the pin moves only on a confirmation of exactly this update ───────

test('a repo behind the template is offered the whole update, listed', () => {
  const f = fixture();
  try {
    const plan = planSharedLibUpgrade({ opsRoot: f.ops, repoDir: f.repo, rules: uiPin });
    assert.ok(plan, 'v1.0.7 against v1.4.0 must be offered');
    assert.equal(plan.from, OLD);
    assert.equal(plan.to, NEW);
    assert.equal(plan.fromTag, 'v1.0.7');
    assert.equal(plan.toTag, 'v1.4.0');
    assert.equal(plan.hasLockfile, true);
    assert.deepEqual(plan.templateFiles, [
      { path: 'src/lib/img.ts', kind: 'added' },
      { path: 'src/lib/motion.ts', kind: 'changed' },
    ], 'identical files are not listed, and site.ts is the studio’s, not the update’s');
    assert.deepEqual(plan.routes, [{ path: 'src/app/api/contact/route.ts', kind: 'changed' }]);
    assert.deepEqual(plan.addedDeps, ['lenis']);
  } finally {
    f.done();
  }
});

test('a current repo, or one pinned to a branch, is offered nothing', () => {
  const f = fixture();
  try {
    write(path.join(f.repo, 'package.json'), JSON.stringify({ dependencies: { '@jdd/ui': NEW } }));
    assert.equal(planSharedLibUpgrade({ opsRoot: f.ops, repoDir: f.repo, rules: uiPin }), null);
    write(path.join(f.repo, 'package.json'), JSON.stringify({ dependencies: { '@jdd/ui': spec('main') } }));
    assert.equal(planSharedLibUpgrade({ opsRoot: f.ops, repoDir: f.repo, rules: uiPin }), null);
  } finally {
    f.done();
  }
});

test('an export that does not confirm the update is refused, and only a matching one applies it', () => {
  const due = { from: OLD, to: NEW };
  assert.equal(decideUpgrade(due, undefined).kind, 'refuse', 'no confirmation: refused');
  assert.equal(decideUpgrade(due, true).kind, 'refuse', 'a bare "yes" names no update');
  assert.equal(decideUpgrade(due, { to: NEW }).kind, 'refuse', 'both ends must be named');
  assert.equal(
    decideUpgrade(due, { from: OLD, to: spec('v1.3.0') }).kind,
    'refuse',
    'confirming v1.3.0 does not cover the v1.4.0 the template now pins',
  );
  assert.equal(decideUpgrade(due, { from: OLD, to: NEW }).kind, 'apply');
  assert.equal(decideUpgrade(null, { from: OLD, to: NEW }).kind, 'none', 'nothing due, nothing moves');
  assert.equal(confirmsUpgrade(due, { from: OLD, to: NEW }), true);
});

test('a template pin that is not a version tag is never handed to npm', () => {
  const f = fixture();
  try {
    write(path.join(f.ops, 'template/package.json'), JSON.stringify({ dependencies: { '@jdd/ui': `${spec('v1.4.0')}&calc` } }));
    // Not a tag at all, so uiPinToAdopt leaves it alone…
    assert.equal(planSharedLibUpgrade({ opsRoot: f.ops, repoDir: f.repo, rules: uiPin }), null);
    // …and a tag with a hostile owner is refused outright rather than offered.
    write(path.join(f.ops, 'template/package.json'), JSON.stringify({ dependencies: { '@jdd/ui': 'github:a&b/jdd-ui#v1.4.0' } }));
    assert.throws(() => planSharedLibUpgrade({ opsRoot: f.ops, repoDir: f.repo, rules: uiPin }), /will not install/);
  } finally {
    f.done();
  }
});

/**
 * The route itself can't be loaded here (it pulls @jdd/schema through export.ts), so its ORDER is
 * asserted on the source: the decision comes before the first write, and the only install that
 * names a spec runs on an applied decision.
 */
test('the export decides on the update before it writes anything, and installs only an applied one', () => {
  const src = read(path.join(CONSOLE, 'src/app/api/build/export/route.ts'));
  const decide = src.indexOf('decideUpgrade(');
  const refuse = src.indexOf("decision.kind === 'refuse'");
  const firstWrites = [
    'readRepoSiteContent(repoRoot',
    'copyTemplate(repoRoot',
    'writeOnboardRoutes(repoRoot',
    'mergePackageJson(repoRoot',
    'writeSiteContent(',
    'placeComponents(repoRoot',
  ].map((s) => [s, src.indexOf(s)]);
  assert.ok(decide > -1 && refuse > decide, 'the export decides, then refuses an unconfirmed update');
  for (const [name, at] of firstWrites) {
    assert.ok(at > refuse, `${name} must come after the refusal, so a refused export changes nothing`);
  }
  const installs = [...src.matchAll(/runNpm\(\{ install: ([^}]+) \}/g)].map((m) => m[1].trim());
  assert.deepEqual(installs, ['upgrade.to'], 'one spec install, of the confirmed target');
  assert.match(src, /if \(decision\.kind === 'apply'\) upgrade = decision\.plan;/, 'set only from an applied decision');
});

// ─── rule 2: the installed form and the route must agree ───────────────────────

test('the current form and the current route agree', () => {
  const r = checkFormRoutePairing({ consentTextSrc: CURRENT_CONSENT_TEXT, leadFormSrc: CURRENT_FORM, routeSrc: CURRENT_ROUTE });
  assert.deepEqual(r, { ok: true, version: 'lead-call-consent-v1' });
});

test('a v1.0.7 form beside the consent-checking route is refused: no callback would ever be placed', () => {
  const r = checkFormRoutePairing({ consentTextSrc: null, leadFormSrc: OLD_FORM, routeSrc: CURRENT_ROUTE, installedLabel: 'v1.0.7' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /@jdd\/ui v1\.0\.7 has no AI-call consent box/);
  assert.match(r.reason, /callback on this site would stop/);
});

test('a consent form beside the route from before consent is refused: the AI would call without a check', () => {
  const r = checkFormRoutePairing({ consentTextSrc: CURRENT_CONSENT_TEXT, leadFormSrc: CURRENT_FORM, routeSrc: PRE_CONSENT_ROUTE });
  assert.equal(r.ok, false);
  assert.match(r.reason, /does not check consent before the AI calls a lead back, while the form/);
});

test('an old form beside an old route is refused too: every route now must check consent', () => {
  const r = checkFormRoutePairing({ consentTextSrc: null, leadFormSrc: OLD_FORM, routeSrc: PRE_CONSENT_ROUTE });
  assert.equal(r.ok, false);
});

test('a consent version or wording the route does not know is refused', () => {
  const v2 = CURRENT_CONSENT_TEXT.replace("'lead-call-consent-v1'", "'lead-call-consent-v2'");
  const r1 = checkFormRoutePairing({ consentTextSrc: v2, leadFormSrc: CURRENT_FORM, routeSrc: CURRENT_ROUTE });
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /"lead-call-consent-v2", which .* does not accept/);

  const reworded = CURRENT_CONSENT_TEXT.replace('The call may be recorded.', 'The call is recorded.');
  assert.notEqual(reworded, CURRENT_CONSENT_TEXT, 'the fixture edit must land');
  const r2 = checkFormRoutePairing({ consentTextSrc: reworded, leadFormSrc: CURRENT_FORM, routeSrc: CURRENT_ROUTE });
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /wording .* differs/);
});

test('the check reads the INSTALLED package, so a pin that says v1.4.0 over a v1.0.7 install is caught', () => {
  const f = fixture();
  try {
    // package.json already claims the new version; node_modules still holds the old form.
    write(path.join(f.repo, 'package.json'), JSON.stringify({ dependencies: { '@jdd/ui': NEW } }));
    write(path.join(f.repo, 'src/app/api/contact/route.ts'), CURRENT_ROUTE);
    const ui = path.join(f.repo, 'node_modules/@jdd/ui');
    write(path.join(ui, 'package.json'), JSON.stringify({ name: '@jdd/ui', version: '1.0.7' }));
    write(path.join(ui, 'src/LeadForm.tsx'), OLD_FORM);
    const stale = checkRepoFormRoutePairing(f.repo);
    assert.equal(stale.ok, false);
    assert.match(stale.reason, /v1\.0\.7/);

    // The confirmed update installs the real package; then the pair agrees.
    rmSync(ui, { recursive: true, force: true });
    cpSync(path.join(CONSOLE, 'node_modules/@jdd/ui'), ui, { recursive: true });
    assert.deepEqual(checkRepoFormRoutePairing(f.repo), { ok: true, version: 'lead-call-consent-v1' });
  } finally {
    f.done();
  }
});

test('the export checks the pair after install and before the build, the commit and the push', () => {
  const src = read(path.join(CONSOLE, 'src/app/api/build/export/route.ts'));
  const install = src.indexOf("runNpm('install'");
  const pairing = src.indexOf('checkRepoFormRoutePairing(repoDir)');
  const refusal = src.indexOf('if (!pairing.ok) {');
  const build = src.indexOf("runNpm('run build'");
  const commit = src.indexOf("['commit', '-m', commitMessage]");
  const push = src.indexOf('pushArgs, { timeout: PUSH_TIMEOUT_MS }');
  assert.ok(install > -1 && pairing > install, 'checked against what was actually installed');
  assert.ok(refusal > pairing && build > refusal && commit > build && push > commit);
  const branch = src.slice(refusal, build);
  assert.match(branch, /return;/, 'a mismatch stops the export');
});
