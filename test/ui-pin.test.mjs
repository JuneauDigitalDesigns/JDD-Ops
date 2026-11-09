import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { uiPinToAdopt } from '../lib/ui-pin.js';

/**
 * A re-run of onboard.js must carry a client repo's @jdd/ui forward.
 *
 * The route is rewritten on every run and the pin never was. Both e2e fixtures sat three releases
 * behind (v1.0.7, v1.1.0), so a re-run would pair the consent-checking route with a form that has
 * no consent box: no callback ever placed, and no error anywhere.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spec = (v) => `github:JuneauDigitalDesigns/jdd-ui#${v}`;

test('a repo behind the template moves to the template pin', () => {
  assert.equal(uiPinToAdopt(spec('v1.0.7'), spec('v1.4.0')), spec('v1.4.0'));
  assert.equal(uiPinToAdopt(spec('v1.3.9'), spec('v1.4.0')), spec('v1.4.0'));
  assert.equal(uiPinToAdopt(spec('v1.9.0'), spec('v1.10.0')), spec('v1.10.0'), 'compared as numbers');
});

test('a current or newer repo is left alone', () => {
  assert.equal(uiPinToAdopt(spec('v1.4.0'), spec('v1.4.0')), null);
  assert.equal(uiPinToAdopt(spec('v2.0.0'), spec('v1.4.0')), null, 'never a downgrade');
});

test('a pin that is not a version tag is left alone', () => {
  assert.equal(uiPinToAdopt(spec('main'), spec('v1.4.0')), null);
  assert.equal(uiPinToAdopt(undefined, spec('v1.4.0')), null);
  assert.equal(uiPinToAdopt(spec('v1.0.7'), undefined), null);
});

test('onboard.js moves the pin before its build, with the spec named explicitly', () => {
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  const routes = src.indexOf('    writeApiRoutes(repoDir);');
  const pin = src.indexOf('    refreshUiPin(repoDir);');
  const build = src.indexOf('    buildClientRepo(repoDir);');
  assert.ok(routes > -1 && pin > routes, 'the pin moves in the same pass that rewrites the route');
  assert.ok(build > pin, 'and before the build that proves the result compiles');
  // npm does not re-resolve a github: dependency when only the tag moves in package.json.
  assert.match(src, /run\(`npm install "\$\{next\}"`/);
});

/**
 * The console export moves a client repo's pin too, after the operator confirms it. It reads the
 * same rule through uiPinMove rather than keeping its own copy, so the two can't disagree about
 * which repos are behind.
 */
test('uiPinMove reads both package.json files and applies the one rule', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { uiPinMove } = await import('../lib/ui-pin.js');
  const dir = mkdtempSync(resolve(tmpdir(), 'ui-pin-'));
  const pkg = (sub, ui) => {
    mkdirSync(resolve(dir, sub), { recursive: true });
    writeFileSync(resolve(dir, sub, 'package.json'), JSON.stringify({ dependencies: ui ? { '@jdd/ui': ui } : {} }));
  };
  try {
    pkg('template', spec('v1.4.0'));
    pkg('repo', spec('v1.0.7'));
    assert.deepEqual(uiPinMove(resolve(dir, 'repo'), resolve(dir, 'template')), { from: spec('v1.0.7'), to: spec('v1.4.0') });
    pkg('repo', spec('v1.4.0'));
    assert.equal(uiPinMove(resolve(dir, 'repo'), resolve(dir, 'template')), null);
    assert.equal(uiPinMove(resolve(dir, 'missing'), resolve(dir, 'template')), null, 'no repo package.json');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('only a github:owner/repo#vX.Y.Z spec is installable on a command line', async () => {
  const { isInstallableUiSpec } = await import('../lib/ui-pin.js');
  assert.equal(isInstallableUiSpec(spec('v1.4.0')), true);
  assert.equal(isInstallableUiSpec(spec('main')), false);
  assert.equal(isInstallableUiSpec('github:a&calc/jdd-ui#v1.4.0'), false);
  assert.equal(isInstallableUiSpec(`${spec('v1.4.0')} && calc`), false);
  assert.equal(isInstallableUiSpec(undefined), false);
});

test('onboard.js takes its pin move from uiPinMove, the rule the console uses', () => {
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  assert.match(src, /import \{ uiPinMove \} from '\.\/lib\/ui-pin\.js';/);
  assert.match(src, /const next = uiPinMove\(repoDir, resolve\(SCRIPT_DIR, 'template'\)\)\?\.to;/);
});
