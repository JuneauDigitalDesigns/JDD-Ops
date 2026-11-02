// The export-time shared-library guard, encoded so its failure mode cannot come back silently.
//
// Every case below is a defect that actually shipped. The guard was written to catch a component
// importing a symbol its client repo does not provide (the `parallaxY` incident). Then the shared
// helpers moved into @jdd/ui behind four-line `export *` shims, the guard's parser had no case for
// `export * from`, and it read every shim as ZERO exports — so an export of `_e2e_test_starter`
// aborted with 47 "the repo's copy does not export" problems against a template that was entirely
// correct, while `staleRepo` (computed the same way off template/) was permanently false and the
// branch that would have been right was unreachable. None of that was covered by a test.
//
// Imports ../src/lib/libExports.ts, never ../src/lib/export.ts: export.ts pulls in @jdd/schema,
// whose package.json declares no "exports" main, so the tsx loader cannot resolve it
// (ERR_PACKAGE_PATH_NOT_EXPORTED) even though Next's bundler can.
//
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readLibExports,
  verifyLibImports,
  pinnedTag,
  compareTags,
  verifyUiPins,
} from '../src/lib/libExports.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'test/helpers/lib-fixtures');
const LIBS = path.join(FIX, 'libs');
/** Stands in for node_modules; not named that, or .gitignore would drop the fixture. */
const PKGS = path.join(FIX, 'pkgs');
const PINS = path.join(FIX, 'pins');

const read = (lib) => readLibExports(LIBS, lib, PKGS);

test('a shim resolves to the package it re-exports', () => {
  const { names, unresolved } = read('skins');
  assert.deepEqual(unresolved, [], 'the star should have been followed');
  assert.ok(names.has('skinClasses'), 'skinClasses comes from @jdd/ui/skins');
  assert.ok(names.has('SkinId'), 'a type export counts too');
});

test('a shim whose subpath uses the conditional form still resolves', () => {
  // @jdd/ui maps "./motion" to { "import": "./src/motion.ts" } in the fixture.
  const { names, unresolved } = read('motion');
  assert.deepEqual(unresolved, []);
  assert.ok(names.has('EASE'));
  assert.ok(names.has('stillFor'));
});

test('a real lib file still parses — every declaration form', () => {
  const { names, unresolved } = read('real');
  assert.deepEqual(unresolved, []);
  for (const n of ['EASE', 'stillFor', 'Named', 'Shape', 'Box', 'mutable', 'hidden', 'exposed']) {
    assert.ok(names.has(n), `${n} should be found`);
  }
  assert.ok(!names.has('aliased'), 'the local name behind `as` is not the export');
});

test('a symbol the package does not export is STILL reported missing through a shim', () => {
  // The parallaxY incident, which is the whole reason the guard exists. A fix for the false
  // positives that also stopped catching this would be worse than the bug.
  const { names } = read('skins');
  assert.ok(!names.has('parallaxY'));
});

test('an unfollowable star is reported as unresolved, not as missing symbols', () => {
  const { names, unresolved } = read('orphan');
  assert.deepEqual(unresolved, ['@nope/absent/thing']);
  assert.equal(names.size, 0, 'nothing could be learned about this lib');
  // The caller contract: names is EMPTY here, exactly as it was for every shim under the old
  // parser. `unresolved` being non-empty is the only thing distinguishing "provides nothing"
  // from "could not be checked", so a caller must branch on it before reporting a symbol missing.
  assert.notDeepEqual(unresolved, [], 'callers must be able to tell this apart');
});

test('a relative star resolves, and a cycle terminates', () => {
  const { names, unresolved } = read('chain');
  assert.deepEqual(unresolved, []);
  assert.ok(names.has('fromImpl'));
});

test('`export * as ns` contributes the namespace name, not the target’s names', () => {
  const { names, unresolved } = read('ns');
  assert.deepEqual(unresolved, []);
  assert.ok(names.has('motion'), 'the namespace binding');
  assert.ok(!names.has('EASE'), 'a namespace does not re-export individual names');
});

test('a .tsx lib is found when there is no .ts', () => {
  assert.ok(read('widget').names.has('widgetOnly'));
});

test('a missing lib file reads as null, not as empty', () => {
  // Keeps the distinct "'@/lib/x' does not exist in the client repo" message reachable.
  assert.equal(read('nosuchlib').names, null);
});

// --- the import check, and which side it blames ---------------------------------------------
//
// The staleRepo verdict is the whole reason these two cases have to be told apart: one says
// "export again with overwrite", the other says "fix the template". It was unreachable for as
// long as the parser stopped at a shim, and the first real export after the parser fix needed
// it straight away — _e2e_test_growth/repo carried a pre-migration img.ts with no
// responsivePicture while the template's shim provided it.

const REPO = path.join(FIX, 'repo');
const TEMPLATE_LIBS = path.join(FIX, 'template-libs');
const HERO = 'src/components/catalog/hero/HeroSplit.tsx';

const verify = (templateLibDir = TEMPLATE_LIBS) =>
  verifyLibImports({ repoDir: REPO, templateLibDir, nodeModules: PKGS, files: [HERO] });

test('a symbol the template has and the repo does not is a STALE REPO', () => {
  const problems = verify();
  const missing = problems.filter((p) => /responsivePicture/.test(p.message));
  assert.equal(missing.length, 1);
  assert.equal(missing[0].staleRepo, true, 'template/ provides it, so only the repo is behind');
});

test('symbols both sides provide produce no problem at all', () => {
  const problems = verify();
  assert.ok(!problems.some((p) => /responsiveImage|skinClasses|SkinId/.test(p.message)));
});

test('a lib missing from the repo and from the template is not blamed on the repo', () => {
  const problems = verify();
  const absent = problems.filter((p) => /'@\/lib\/absent'/.test(p.message));
  assert.equal(absent.length, 1);
  assert.match(absent[0].message, /does not exist in the client repo/);
  assert.equal(absent[0].staleRepo, false, 'template/ has no absent.ts either — not a stale repo');
});

test('a symbol neither side provides is template drift, not a stale repo', () => {
  // Point the template at the repo's own stale libs: now nothing provides responsivePicture.
  const problems = verify(path.join(REPO, 'src/lib'));
  const missing = problems.filter((p) => /responsivePicture/.test(p.message));
  assert.equal(missing.length, 1);
  assert.equal(missing[0].staleRepo, false);
});

test('an unresolvable star in the TEMPLATE never upgrades to a stale-repo verdict', () => {
  // template-libs replaced by the fixture dir whose img.ts points at a missing package. A
  // template that cannot be read must not be reported as "the template has it, your repo is old".
  const problems = verifyLibImports({
    repoDir: REPO,
    templateLibDir: LIBS, // libs/ has no img.ts at all
    nodeModules: PKGS,
    files: [HERO],
  });
  const missing = problems.filter((p) => /responsivePicture/.test(p.message));
  assert.equal(missing.length, 1);
  assert.equal(missing[0].staleRepo, false);
});

test('pinnedTag reads the tag off a github spec', () => {
  assert.equal(pinnedTag('github:JuneauDigitalDesigns/jdd-ui#v1.0.1'), 'v1.0.1');
  assert.equal(pinnedTag('github:JuneauDigitalDesigns/jdd-ui#main'), null);
  assert.equal(pinnedTag(undefined), null);
});

test('compareTags is numeric per segment', () => {
  assert.ok(compareTags('v1.0.1', 'v1.0.7') < 0);
  // A string compare gets this one backwards, which is the point of parsing.
  assert.ok(compareTags('v1.0.10', 'v1.0.7') > 0);
  assert.equal(compareTags('v1.0.7', 'v1.0.7'), 0);
  assert.equal(compareTags('main', 'v1.0.7'), null);
});

const pin = (f) => path.join(PINS, f);

test('a repo behind the template is a stale repo, not template drift', () => {
  const { problems, uncomparable } = verifyUiPins({
    consolePkg: pin('console.json'),
    templatePkg: pin('template.json'),
    repoPkg: pin('repo-old.json'),
  });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].staleRepo, true);
  assert.match(problems[0].message, /v1\.0\.1.*v1\.0\.7/);
  assert.deepEqual(uncomparable, []);
});

test('a template behind the console is template drift', () => {
  const { problems } = verifyUiPins({
    consolePkg: pin('console.json'),
    templatePkg: pin('template-old.json'),
    repoPkg: pin('template-old.json'),
  });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].staleRepo, false);
  assert.match(problems[0].message, /template is out of date/);
});

test('matching pins are silent', () => {
  const { problems, uncomparable } = verifyUiPins({
    consolePkg: pin('console.json'),
    templatePkg: pin('template.json'),
    repoPkg: pin('template.json'),
  });
  assert.deepEqual(problems, []);
  assert.deepEqual(uncomparable, []);
});

test('a repo AHEAD of the template is not a problem', () => {
  const { problems } = verifyUiPins({
    consolePkg: pin('template-old.json'),
    templatePkg: pin('template-old.json'),
    repoPkg: pin('console.json'),
  });
  assert.deepEqual(problems, []);
});

test('a branch pin is reported as uncomparable, never guessed at', () => {
  const { problems, uncomparable } = verifyUiPins({
    consolePkg: pin('console.json'),
    templatePkg: pin('template.json'),
    repoPkg: pin('repo-branch.json'),
  });
  assert.deepEqual(problems, [], 'no verdict without a comparable tag');
  assert.deepEqual(uncomparable, ['github:JuneauDigitalDesigns/jdd-ui#main']);
});

test('a repo with no @jdd/ui dependency at all is a stale repo', () => {
  const { problems } = verifyUiPins({
    consolePkg: pin('console.json'),
    templatePkg: pin('template.json'),
    repoPkg: pin('repo-nodep.json'),
  });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].staleRepo, true);
  assert.match(problems[0].message, /no "@jdd\/ui" dependency/);
});

test('the REAL template and console libs read as non-empty', () => {
  // The regression itself, against the files that actually failed the _e2e_test_starter export.
  // Under the old parser every one of these came back as an empty set.
  const templateLibs = path.join(ROOT, '../template/src/lib');
  const nodeModules = path.join(ROOT, 'node_modules');
  for (const [lib, symbol] of [
    ['skins', 'skinClasses'],
    ['motion', 'stillFor'],
    ['img', 'responsiveImage'],
    ['icons', 'serviceIcon'],
    ['LeadForm', 'LeadForm'],
  ]) {
    const { names, unresolved } = readLibExports(templateLibs, lib, nodeModules);
    assert.deepEqual(unresolved, [], `${lib}: @jdd/ui must resolve from console/node_modules`);
    assert.ok(names?.has(symbol), `template/src/lib/${lib} must provide ${symbol}`);
  }
});
