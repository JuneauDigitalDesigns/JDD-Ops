/**
 * Consent to the AI callback has to survive the path a client's site actually takes.
 *
 * The form lives in @jdd/ui, its route lives in jdd-ops, and neither reaches a client repo on its
 * own. The console export copies the template; onboard.js rewrites the route and carries the pin.
 * Each half landing without the other fails silently: no box means no callback, and no error.
 *
 * Imports libExports.ts rather than export.ts, for the reason export-guard.test.mjs gives.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEAD_CALL_CONSENT_TEMPLATE, LEAD_CALL_CONSENT_VERSION } from '@jdd/ui/lead-consent-text';
import { verifyUiPins } from '../src/lib/libExports.ts';
import { uiPinToAdopt } from '../../lib/ui-pin.js';

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(CONSOLE, '..');
const UI = '@jdd/ui';
const FIRST_WITH_THE_BOX = 'github:JuneauDigitalDesigns/jdd-ui#v1.4.0';
const STALE = 'github:JuneauDigitalDesigns/jdd-ui#v1.0.7';

const pinIn = (file) => JSON.parse(readFileSync(file, 'utf8')).dependencies[UI];
const TEMPLATE_PKG = path.join(OPS, 'template/package.json');
const CONSOLE_PKG = path.join(CONSOLE, 'package.json');

test('the template and the console both pin a form that has the consent box', () => {
  const template = pinIn(TEMPLATE_PKG);
  assert.equal(pinIn(CONSOLE_PKG), template, 'preview and export must agree');
  assert.equal(uiPinToAdopt(template, FIRST_WITH_THE_BOX), null, `${template} predates the consent box`);
});

test('a console export over a stale repo is stopped by the pin check', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'call-consent-'));
  try {
    const repoPkg = path.join(dir, 'package.json');
    writeFileSync(repoPkg, JSON.stringify({ dependencies: { [UI]: STALE } }));
    const { problems } = verifyUiPins({ consolePkg: CONSOLE_PKG, templatePkg: TEMPLATE_PKG, repoPkg });
    assert.ok(problems.some((p) => p.staleRepo), 'a form with no box must not ship quietly');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a re-run of onboard.js carries the same stale repo forward', () => {
  const template = pinIn(TEMPLATE_PKG);
  assert.equal(uiPinToAdopt(STALE, template), template);
});

test("the route's copy of the wording is the package's, for the pinned version", () => {
  // The route re-derives the hash before dialing, so a difference means every callback stops.
  const route = readFileSync(path.join(OPS, 'lib/site-routes/contact.route.ts'), 'utf8');
  assert.ok(route.includes(`'${LEAD_CALL_CONSENT_VERSION}':`), 'the route accepts this version');
  assert.ok(route.includes(LEAD_CALL_CONSENT_TEMPLATE), 'word for word');
});
