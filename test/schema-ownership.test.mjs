/**
 * Who owns a client repo's `src/data/site.ts` — provisioning or the console.
 *
 * ── The two bugs this encodes ───────────────────────────────────────────────
 *
 * Both programs write that file, and whichever ran last used to win all of it.
 *
 * 1. onboard.js going last. Step 3 spliced `clients/{slug}/site.ts` — the raw INTAKE —
 *    straight over whatever the console had exported. So "edit in the console, export,
 *    re-run onboard" silently reverted the site to its intake: anchor `#about` nav instead of
 *    real routes, intake copy instead of generated copy, hotlinked stock instead of localized
 *    images. A client shipped exactly that.
 *
 * 2. The console going last — the dangerous one. Its payload carries the OWNER'S phone from
 *    the intake, while the repo carries the published JDD Twilio number that
 *    `applyTwilioNumberToSite` wrote. Republish the owner's line and every inbound caller
 *    reaches the owner directly instead of `/api/voice`: no human-first forward, no Retell
 *    fallback on no-answer, no Airtable row. CLAUDE.md records this as a failure with no error
 *    anywhere to find — the number looks configured, the agent looks healthy, the call log is
 *    simply empty.
 *
 * So ownership is FIELD-level (lib/provisioned-fields.js). These tests drive the REAL
 * onboard.js functions against temp repos; the console half is covered by
 * console/test/provisioned-fields.test.mjs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { installClientSchema, updateRepoSchemaFields } from '../onboard.js';
import { CONSOLE_CONTENT_MARKER, extractContentObject } from '../lib/provisioned-fields.js';

const OWNER_PHONE = '(407) 555-0100';
const TWILIO_PHONE = '(407) 555-7788';

/** Content as the CONSOLE would have exported it: generated copy, route-based nav. */
const consoleContent = () => ({
  brand: { name: 'Fixture Co.', phone: OWNER_PHONE, phoneHref: 'tel:+14075550100' },
  hero: { h: 'Generated headline the operator approved' },
  nav: [{ label: 'Services', href: '/services' }],
});

/** Content as the INTAKE holds it: placeholder copy, single-page anchor nav. */
const intakeContent = () => ({
  brand: { name: 'Fixture Co.', phone: OWNER_PHONE, phoneHref: 'tel:+14075550100' },
  hero: { h: 'Raw intake headline' },
  nav: [{ label: 'Services', href: '#services' }],
});

/** A repo whose site.ts was written by the console (carries the provenance marker). */
function repoWithConsoleSchema(content = consoleContent()) {
  const repoDir = mkdtempSync(resolve(tmpdir(), 'jdd-schema-'));
  mkdirSync(resolve(repoDir, 'src', 'data'), { recursive: true });
  writeFileSync(
    resolve(repoDir, 'src/data/site.ts'),
    `// ${CONSOLE_CONTENT_MARKER}\nexport interface SiteContent {}\n` +
      `export const CONTENT: SiteContent = ${JSON.stringify(content, null, 2)};\n`,
    'utf8',
  );
  return repoDir;
}

/** A repo still carrying the template's placeholder schema (no marker). */
function repoWithTemplateSchema() {
  const repoDir = mkdtempSync(resolve(tmpdir(), 'jdd-schema-'));
  mkdirSync(resolve(repoDir, 'src', 'data'), { recursive: true });
  writeFileSync(
    resolve(repoDir, 'src/data/site.ts'),
    `export interface SiteContent {}\nexport const CONTENT: SiteContent = ${JSON.stringify({ brand: { name: 'Template' } }, null, 2)};\n`,
    'utf8',
  );
  return repoDir;
}

const readContent = (repoDir) => extractContentObject(readFileSync(resolve(repoDir, 'src/data/site.ts'), 'utf8'));

test('re-provisioning does NOT revert console-authored content to the intake', () => {
  const repoDir = repoWithConsoleSchema();
  try {
    installClientSchema(repoDir, intakeContent());

    const after = readContent(repoDir);
    assert.equal(after.hero.h, 'Generated headline the operator approved', 'the console’s copy must survive');
    assert.deepEqual(after.nav, [{ label: 'Services', href: '/services' }], 'route nav must not revert to anchors');
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('a template-schema repo IS still spliced — the intake is the only content it has', () => {
  // The other half. Skipping unconditionally would leave a freshly scaffolded repo with the
  // template's placeholder brand forever.
  const repoDir = repoWithTemplateSchema();
  try {
    installClientSchema(repoDir, intakeContent());
    assert.equal(readContent(repoDir).hero.h, 'Raw intake headline');
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('the provenance marker survives a provisioning write', () => {
  // writeClientSchema preserves everything above the CONTENT marker. If the stamp were lost,
  // the NEXT run would see an unmarked file and splice the intake over the console's work.
  const repoDir = repoWithConsoleSchema();
  try {
    updateRepoSchemaFields(repoDir, { 'brand.phone': TWILIO_PHONE });
    const src = readFileSync(resolve(repoDir, 'src/data/site.ts'), 'utf8');
    assert.ok(src.includes(CONSOLE_CONTENT_MARKER), 'the file must still identify as console-authored');

    installClientSchema(repoDir, intakeContent());
    assert.equal(readContent(repoDir).hero.h, 'Generated headline the operator approved');
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('the published number is written WITHOUT reverting the console’s content', () => {
  // The exact sequence a re-provision runs: step 3 declines to splice, then the phone swap
  // writes its fields. A wholesale write at the second step would undo the first.
  const repoDir = repoWithConsoleSchema();
  try {
    installClientSchema(repoDir, intakeContent());
    const ok = updateRepoSchemaFields(repoDir, {
      'brand.phone': TWILIO_PHONE,
      'brand.phoneHref': 'tel:+14075557788',
    });
    assert.equal(ok, true);

    const after = readContent(repoDir);
    assert.equal(after.brand.phone, TWILIO_PHONE, 'the Twilio number must be published');
    assert.equal(after.brand.phoneHref, 'tel:+14075557788');
    assert.equal(after.hero.h, 'Generated headline the operator approved', 'the copy must be untouched');
    assert.deepEqual(after.nav, [{ label: 'Services', href: '/services' }]);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('updateRepoSchemaFields reports failure rather than silently skipping a field', () => {
  // The caller falls back to the wholesale write on false. Publishing the number matters more
  // than preserving copy: leave it unwritten and the site advertises the owner's line.
  const repoDir = mkdtempSync(resolve(tmpdir(), 'jdd-schema-'));
  try {
    mkdirSync(resolve(repoDir, 'src', 'data'), { recursive: true });
    assert.equal(updateRepoSchemaFields(repoDir, { 'brand.phone': TWILIO_PHONE }), false, 'no file at all');

    writeFileSync(resolve(repoDir, 'src/data/site.ts'), 'export const CONTENT: SiteContent = {not,,json};\n');
    assert.equal(updateRepoSchemaFields(repoDir, { 'brand.phone': TWILIO_PHONE }), false, 'unparseable content');
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('the phone swap writes through the field-level path, not a wholesale rewrite', () => {
  // applyTwilioNumberToSite used to call writeClientSchema(repoDir, content) with the INTAKE
  // object. Correct before installClientSchema existed; now it would publish the number and
  // revert the site in the same breath.
  const src = readFileSync(new URL('../onboard.js', import.meta.url), 'utf8');
  const swap = src.slice(src.indexOf('function applyTwilioNumberToSite'), src.indexOf('function formatPhoneForDisplay'));
  assert.match(swap, /updateRepoSchemaFields\(/, 'the swap must patch fields in place');
  assert.ok(
    swap.indexOf('updateRepoSchemaFields(') < swap.indexOf('writeClientSchema(repoDir, content)'),
    'the wholesale write must only be the fallback, reached when the patch fails',
  );
});

test('the keep-content message maps to the siteContent phase, not an unplanned node', () => {
  // A cross-file contract, so it is asserted across both files rather than trusted.
  // onboard-parse.ts's labelFor() falls back to the raw message for anything PHASE_MAP does
  // not match, and run-plan.ts's mergeRun then flags it `unplanned` and renders it in coral.
  // The first draft of this message began with "Keep", matched nothing, and would have put a
  // spurious coral node on every re-provision of a console-authored client.
  const onboard = readFileSync(new URL('../onboard.js', import.meta.url), 'utf8');
  const fn = onboard.slice(
    onboard.indexOf('function installClientSchema'),
    onboard.indexOf('function updateRepoSchemaFields'),
  );
  const msg = /log\(3, `([^`]+)`\)/.exec(fn);
  assert.ok(msg, 'the keep path must emit a log(3, …) with a literal message');

  const parse = readFileSync(new URL('../console/src/lib/onboard-parse.ts', import.meta.url), 'utf8');
  const entry = /\{ re: (\/Write src\\\/data\\\/site\\\.ts\/i), label: PHASE_LABELS\.siteContent \}/.exec(parse);
  assert.ok(entry, 'PHASE_MAP no longer carries the siteContent entry this message relies on');

  assert.match(msg[1], /Write src\/data\/site\.ts/i, 'the message must match PHASE_MAP’s siteContent regex');
});

test('step 3 still emits exactly one log() call on both paths', () => {
  // The phase contract (console/test/phase-contract.test.mjs) replays recorded dry-run stdout
  // through the real parser and asserts the phases match. Adding, dropping or reordering a
  // log() in step 3 fails it — and `FAIL:` anywhere in check output is treated as a fatal run
  // by onboard-parse.ts, so a skip message must never contain that token.
  const src = readFileSync(new URL('../onboard.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function installClientSchema'), src.indexOf('function updateRepoSchemaFields'));
  assert.equal((fn.match(/\blog\(3,/g) ?? []).length, 1, 'the skip path needs its own single log(3, …)');
  assert.doesNotMatch(fn, /FAIL:/, 'onboard-parse.ts treats FAIL: as a fatal run');
});
