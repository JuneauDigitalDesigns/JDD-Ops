/**
 * The Studio for a client whose repo the console did not make, and the two things that made the
 * studio look like it had lost work.
 *
 * What shipped (2026-11-09): `_e2e_test_growth` is live. Its repo was provisioned by onboard.js
 * (`page.tsx` is still the template's placeholder, there is no `.studio/composition.json`), so
 * BuildWizard read it as never exported and the Studio offered only Launch, no Re-export or
 * Deploy. Re-export/Deploy were also keyed on a server prop, so even a first Launch could not
 * reach Deploy without a reload.
 *
 * Alongside it:
 *   - the Templates popover marked the INTAKE vertical as chosen rather than the template the
 *     composition was built from;
 *   - hydration preferred this browser's localStorage bundle over a newer server draft, so a
 *     window holding an older copy opened with its old template and saved it over the new one;
 *   - the roster hid the test client with a per-browser toggle and said "1 client", so a fresh
 *     Incognito window looked like a different, "test" console.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newerBundle } from '../src/lib/wizardBundle.ts';
import { rosterCountLabel } from '../src/lib/rosterCount.ts';
import { VERTICAL_TEMPLATES, applyVerticalTemplate, templateIdFor } from '../src/app/c/[slug]/build/vertical-templates.tsx';
import { defaultCompositionFor } from '../src/app/c/[slug]/build/page-templates.tsx';

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(path.join(CONSOLE, rel), 'utf8');
const BUILD = 'src/app/c/[slug]/build';

// ─── Re-export + Deploy for any client with a repo ─────────────────────────────

test('the build page tells the wizard whether the repo exists, apart from any export record', () => {
  const page = src(`${BUILD}/page.tsx`);
  assert.match(page, /const hasRepo = existsSync\(resolve\(repoDir, 'package\.json'\)\);/);
  assert.match(page, /hasRepo=\{hasRepo\}/);
});

test('the Studio offers Re-export + Deploy for a repo on disk, and turns Launch into them after a first export', () => {
  const wizard = src(`${BUILD}/BuildWizard.tsx`);
  assert.match(wizard, /const \[repoOnDisk, setRepoOnDisk\] = useState\(hasRepo \|\| exported\);/);
  assert.match(wizard, /alreadyDeployed=\{repoOnDisk\}/, 'gated on the repo, not on a console export record');
  assert.doesNotMatch(wizard, /alreadyDeployed=\{exported\}/);
  assert.match(wizard, /onExported=\{\(\) => setRepoOnDisk\(true\)\}/);

  const studio = src(`${BUILD}/PageStudio.tsx`);
  assert.match(studio, /onExported=\{onExported\}/);
  assert.match(studio, /onDeploy=\{\(\) => \{ setLaunchOpen\(false\); setDeployOpen\(true\); \}\}/, 'Deploy offered after any export');

  const launch = src(`${BUILD}/LaunchDialog.tsx`);
  const done = launch.slice(launch.indexOf("msg.type === 'done'"), launch.indexOf("msg.type === 'error'"));
  assert.match(done, /onExported\?\.\(\);/, 'the Studio hears about a successful export');
  assert.match(launch, /status\.kind === 'done' && onDeploy \? \(/, 'Deploy appears in the dialog once the export is done');
  assert.doesNotMatch(launch, /onDeploy && slugHasRepo/, 'a stale "has repo" read at open must not hide it');
  // The Shared libraries panel and the overwrite box hang off slugHasRepo; the Studio's own answer
  // counts from the first render rather than after the client list loads.
  assert.match(launch, /\(Boolean\(lockedSlug\) && hasRepo\) \|\|/);
  assert.match(studio, /hasRepo=\{alreadyDeployed\}/);
});

// ─── the template that was picked is the one that opens ────────────────────────

test('the newer of this browser’s bundle and the server draft opens', () => {
  const oldLocal = { savedAt: 100, siteComposition: 'hvac' };
  const newServer = { savedAt: 200, siteComposition: 'roofing' };
  assert.equal(newerBundle(oldLocal, newServer), newServer, 'a newer server draft beats an older local copy');
  assert.equal(newerBundle(newServer, oldLocal), newServer, 'and a newer local copy beats an older draft');
  assert.equal(newerBundle({ siteComposition: 'pre-stamp' }, newServer), newServer, 'an unstamped local copy is older than any stamped draft');
  const tie = { savedAt: 100 };
  assert.equal(newerBundle(tie, { savedAt: 100 }), tie, 'a tie keeps this browser’s copy');
  assert.equal(newerBundle(null, newServer), newServer);
  assert.equal(newerBundle(oldLocal, null), oldLocal);
  assert.equal(newerBundle(null, null), null);
});

test('every save is stamped, and hydration takes the newer copy', () => {
  const wizard = src(`${BUILD}/BuildWizard.tsx`);
  assert.match(wizard, /savedAt: Date\.now\(\),/);
  // The newer copy is chosen by startingBundle via newerBundle (test/reload-keeps-work.test.mjs).
  assert.match(wizard, /applyBundle\(start\.bundle \?\? freshBundle\(seed\)\);/);
  assert.doesNotMatch(wizard, /applyBundle\(saved \?\? draftBundle \?\? freshBundle\(seed\)\)/);
});

test('the Templates popover marks the template the composition was built from', () => {
  for (const id of Object.keys(VERTICAL_TEMPLATES)) {
    assert.equal(templateIdFor(applyVerticalTemplate(id)), id, `${id}'s template is recognised as ${id}`);
  }
  assert.equal(templateIdFor(defaultCompositionFor()), null, 'the generic site is no template');

  const studio = src(`${BUILD}/PageStudio.tsx`);
  assert.match(studio, /aria-pressed=\{id === appliedTemplate\}/);
  assert.doesNotMatch(studio, /id === vertical\b/, 'never the intake vertical');
});

/**
 * The export deletes the draft, and the edit layer (where a template's palette and type live) went
 * with it. Reopened, an exported client rebuilt from the intake, so a Deploy after a reload shipped
 * the template's sections in the intake's colours. The baseline is now what the console exported.
 */
test('reopening an exported client starts from the content the console exported, not the intake', async () => {
  const page = src(`${BUILD}/page.tsx`);
  assert.match(page, /return pf\.hasConsoleMarker\(src\) \? pf\.extractContentObject\(src\) : null;/, 'only console-written content');
  assert.match(page, /const exportedRaw = manifest \|\| composition \? await readExportedContent\(repoDir\) : null;/);
  assert.match(page, /exportedContent=\{exportedContent\}/);
  const wizard = src(`${BUILD}/BuildWizard.tsx`);
  const diskWins = wizard.slice(wizard.indexOf("if (start.from === 'disk') {"), wizard.indexOf('} else {', wizard.indexOf("if (start.from === 'disk') {")));
  assert.match(diskWins, /imported: exportedContent \?\? seed,/);

  // And the marker check is the real one: a console-written file reads back, onboard.js's doesn't.
  const pf = await import('../../lib/provisioned-fields.js');
  const content = { brand: { name: 'Your HVAC Co.', palette: { accent: '#E0602C' } }, hero: {} };
  const consoleFile = `// ${pf.CONSOLE_CONTENT_MARKER}\nexport interface X {}\nexport const CONTENT: SiteContent = ${JSON.stringify(content)};\n`;
  const onboardFile = `export interface X {}\nexport const CONTENT: SiteContent = ${JSON.stringify(content)};\n`;
  assert.equal(pf.hasConsoleMarker(consoleFile), true);
  assert.equal(pf.extractContentObject(consoleFile).brand.palette.accent, '#E0602C');
  assert.equal(pf.hasConsoleMarker(onboardFile), false);
});

// ─── the roster says what it is hiding ─────────────────────────────────────────

test('the roster count says how many test clients are hidden', () => {
  assert.equal(rosterCountLabel(1, 1, 2), '1 client · 2 test clients hidden');
  assert.equal(rosterCountLabel(1, 1, 1), '1 client · 1 test client hidden');
  assert.equal(rosterCountLabel(3, 3, 0), '3 clients', 'nothing hidden, nothing said');
  assert.equal(rosterCountLabel(1, 3), '1 of 3');

  const route = src('src/app/api/runbook/clients/route.ts');
  assert.match(route, /const hiddenFixtures = includeFixtures \? 0 : countFixtureFolders\(\);/);
  assert.match(src('src/components/picker/IndexControls.tsx'), /rosterCountLabel\(shown, total, hiddenTest\)/);
  assert.match(src('src/components/picker/ClientIndex.tsx'), /hiddenTest=\{hiddenFixtures\}/);
});
