/**
 * The console/onboard ownership contract for a client repo's `src/data/site.ts`.
 *
 * ── The bug this prevents ───────────────────────────────────────────────────
 *
 * Two programs write that file. The console writes the site's CONTENT (copy, palette, nav,
 * imagery). onboard.js writes a few PROVISIONED FACTS it discovers while standing the client
 * up. Whichever ran last used to win the entire file — which makes both orders wrong.
 *
 * The dangerous direction is the console going last. Its export payload carries the OWNER'S
 * phone number, taken from the intake. The repo carries the published JDD Twilio number that
 * `applyTwilioNumberToSite` wrote. Overwrite that and the live site advertises the owner's
 * line, so every inbound caller reaches the owner directly instead of `/api/voice`: no
 * human-first forward, no Retell fallback on no-answer, no Airtable row. CLAUDE.md documents
 * this as a failure with no error anywhere to find — the number looks configured, the agent
 * looks healthy, the call log is simply empty. It had already shipped once before the swap
 * existed at all.
 *
 * So the ownership is FIELD-level. These tests assert the overlay behaves, and — separately —
 * that the one duplicated string in the contract still matches its source.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROVISIONED_FIELDS,
  CONSOLE_CONTENT_MARKER,
  hasConsoleMarker,
  extractContentObject,
  getPath,
  setPath,
  overlayProvisionedFields,
} from '../../lib/provisioned-fields.js';

const OPS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const OWNER_PHONE = '(407) 555-0100';
const TWILIO_PHONE = '(407) 555-7788';

/** The export payload: content whose phone is still the owner's, straight from the intake. */
const incoming = () => ({
  brand: { name: 'Fixture Co.', phone: OWNER_PHONE, phoneHref: 'tel:+14075550100' },
  hero: { h: 'Freshly generated headline' },
});

/** The repo as provisioning left it: published Twilio number, older copy. */
const provisioned = () => ({
  brand: { name: 'Fixture Co.', phone: TWILIO_PHONE, phoneHref: 'tel:+14075557788' },
  hero: { h: 'Stale intake headline' },
});

test('the published Twilio number survives a console re-export', () => {
  const { content, applied } = overlayProvisionedFields(incoming(), provisioned());

  assert.equal(content.brand.phone, TWILIO_PHONE, 'the owner’s number must never be republished');
  assert.equal(content.brand.phoneHref, 'tel:+14075557788');
  assert.deepEqual(
    applied.map((a) => a.path).sort(),
    ['brand.phone', 'brand.phoneHref'],
    'both overrides must be reported so the export can narrate them',
  );
});

test('the console still wins everything that is not provisioned', () => {
  // The other half of the contract. An overlay that preserved too much would make the console
  // unable to ship a copy change, which is the whole point of the export.
  const { content } = overlayProvisionedFields(incoming(), provisioned());
  assert.equal(content.hero.h, 'Freshly generated headline');
});

test('phone and phoneHref move together', () => {
  // Publishing one without the other shows one number and dials another.
  assert.ok(PROVISIONED_FIELDS.includes('brand.phone'));
  assert.ok(PROVISIONED_FIELDS.includes('brand.phoneHref'));
});

test('an unprovisioned client is untouched, and reports no overrides', () => {
  const { content, applied } = overlayProvisionedFields(incoming(), null);
  assert.equal(content.brand.phone, OWNER_PHONE);
  assert.deepEqual(applied, []);
});

test('an empty or missing provisioned value never overwrites a real one', () => {
  // A half-written repo must not blank the site's phone number.
  const { content, applied } = overlayProvisionedFields(incoming(), { brand: { phone: '', phoneHref: null } });
  assert.equal(content.brand.phone, OWNER_PHONE);
  assert.deepEqual(applied, []);
});

test('the overlay does not mutate either argument', () => {
  const a = incoming();
  const b = provisioned();
  overlayProvisionedFields(a, b);
  assert.equal(a.brand.phone, OWNER_PHONE, 'the payload must not be mutated in place');
  assert.equal(b.brand.phone, TWILIO_PHONE);
});

test('a site.ts written by the console is recognised as console-authored', () => {
  const src = `// ${CONSOLE_CONTENT_MARKER}\nexport interface SiteContent {}\nexport const CONTENT: SiteContent = ${JSON.stringify(incoming(), null, 2)};\n`;
  assert.ok(hasConsoleMarker(src));
  assert.equal(extractContentObject(src).brand.phone, OWNER_PHONE);
});

test('the bare template site.ts is NOT console-authored', () => {
  // The distinction that decides whether onboard.js splices the intake in. Read from disk, so
  // a template that grows a marker-like comment makes this fail rather than silently flip
  // provisioning into "keep whatever is there" on a repo with no content yet.
  const src = readFileSync(resolve(OPS_ROOT, 'template/src/data/site.ts'), 'utf8');
  assert.equal(hasConsoleMarker(src), false);
});

test('extractContentObject declines anything it cannot parse as content', () => {
  assert.equal(extractContentObject('export const CONTENT: SiteContent = { trailing,, }'), null);
  assert.equal(extractContentObject('no marker here'), null);
  assert.equal(extractContentObject(null), null);
});

test('setPath refuses to tunnel through a non-object instead of clobbering it', () => {
  const obj = { brand: 'a string, somehow' };
  assert.equal(setPath(obj, 'brand.phone', 'x'), false);
  assert.equal(obj.brand, 'a string, somehow');
  assert.equal(getPath(obj, 'brand.phone'), undefined);
});

test('the marker string mirrored in export.ts matches its source', () => {
  // The ONE duplicated value in this contract. `writeSiteContent` is synchronous while the
  // ops-root module is reached by an async dynamic import, so the string is mirrored in
  // export.ts. Let the two diverge and onboard.js stops recognising console-authored files —
  // and silently goes back to reverting every export to the intake.
  //
  // Read as TEXT rather than imported: export.ts pulls in `server-only` and @jdd/schema,
  // neither of which resolves under the tsx test loader (see export-guard.test.mjs).
  const src = readFileSync(resolve(OPS_ROOT, 'console/src/lib/export.ts'), 'utf8');
  const m = /export const CONSOLE_CONTENT_MARKER = '([^']+)';/.exec(src);
  assert.ok(m, 'export.ts must declare CONSOLE_CONTENT_MARKER as a plain string literal');
  assert.equal(m[1], CONSOLE_CONTENT_MARKER, 'the mirrored marker has drifted from lib/provisioned-fields.js');
});

test('the exporter actually stamps the marker it claims to', () => {
  // A constant nobody writes into the file would make `hasConsoleMarker` false forever, and
  // onboard.js would revert every export while this whole contract looked implemented.
  const src = readFileSync(resolve(OPS_ROOT, 'console/src/lib/export.ts'), 'utf8');
  assert.match(
    src,
    /\$\{CONSOLE_CONTENT_MARKER\}/,
    'writeSiteContent must interpolate the provenance marker into the file it writes',
  );
});

test('the export route carries provisioned fields forward before writing', () => {
  // The console half of the contract, asserted at its call site. The overlay helper existing
  // but never being applied is the failure mode that would reinstate the phone revert.
  const route = readFileSync(resolve(OPS_ROOT, 'console/src/app/api/build/export/route.ts'), 'utf8');
  assert.match(route, /preserveProvisioned\s*\(/, 'the export must apply the provisioned-field overlay');

  // Both positions are asserted present FIRST. indexOf returns -1 for a missing needle, and
  // -1 < anything — so a bare ordering comparison would pass precisely when the snapshot had
  // been deleted outright, which is the failure it is meant to catch.
  const snapshotAt = route.indexOf('readRepoSiteContent(');
  const copyAt = route.indexOf('copyTemplate(');
  assert.ok(snapshotAt >= 0, 'the export must snapshot the repo’s provisioned site.ts');
  assert.ok(copyAt >= 0, 'the export must still copy the template');
  assert.ok(
    snapshotAt < copyAt,
    'the provisioned snapshot must be taken BEFORE copyTemplate reverts src/data/site.ts to the template — ' +
      'read it afterwards and the snapshot is of the template, so the overlay is a no-op',
  );
});
