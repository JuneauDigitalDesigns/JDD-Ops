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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readLibExports,
  verifyLibImports,
  pinnedTag,
  compareTags,
  verifyUiPins,
  verifyUiLock,
  parseLsRemoteTags,
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

// ─── the lockfile must resolve the tag the pin names ──────────────────────────
//
// These encode the near-miss of 2026-11-02. Bumping @jdd/ui to v1.3.0 (the SMS consent
// disclosure) and running `npm install` left BOTH lockfiles resolving v1.2.0's commit, and
// `node_modules/@jdd/ui/src/` with no lead-consent-text.ts in it. Every package.json claimed
// v1.3.0 while the old form — the one with no disclosure — was what would have built. npm does
// not re-resolve a `github:` ref when only the tag moves.
//
// The two commit shas below are real: `b55deff` is what v1.3.0 points at and `16eabee` is
// v1.2.0, both read off the repository. Invented shas would make these tests agree with
// themselves about a shape the vendor never produced.

const V130 = 'b55deff4a4c6494db63ad6f43b456dd9a8f1a7f4';
const V120 = '16eabee3348cfed0aa62cff0b5262407b7458d3b';
const TAGS = { 'v1.3.0': V130, 'v1.2.0': V120 };

test('a lockfile that resolves the pinned tag is silent', () => {
  const { problems, uncheckable } = verifyUiLock({
    pkgPath: pin('pkg-v130.json'),
    lockPath: pin('lock-good.json'),
    tagCommits: TAGS,
  });
  assert.deepEqual(problems, []);
  assert.deepEqual(uncheckable, []);
});

test('a lockfile still resolving the PREVIOUS commit is a problem', () => {
  // THE NEAR-MISS. The lock agrees about the tag and resolves the old commit anyway, which is
  // precisely what `npm install` leaves behind, and what no other check here would notice.
  const { problems, uncheckable } = verifyUiLock({
    pkgPath: pin('pkg-v130.json'),
    lockPath: pin('lock-stale-resolved.json'),
    tagCommits: TAGS,
    label: 'console',
  });
  assert.equal(problems.length, 1, `expected one problem, got ${JSON.stringify(problems)}`);
  assert.match(problems[0].message, /v1\.3\.0/);
  assert.match(problems[0].message, /b55deff/, 'must name the commit the tag points at');
  assert.match(problems[0].message, /16eabee/, 'and the commit actually installed');
  assert.match(problems[0].message, /npm install/, 'and how to fix it');
  assert.match(problems[0].message, /^console: /, 'and which lockfile');
  assert.deepEqual(uncheckable, []);
});

test('a lockfile never regenerated at all is reported as such', () => {
  // The lock still records the old SPEC, not just the old commit. Worth its own message: the
  // fix is the same but the diagnosis is "you edited package.json and nothing else".
  const { problems } = verifyUiLock({
    pkgPath: pin('pkg-v130.json'),
    lockPath: pin('lock-stale-spec.json'),
    tagCommits: TAGS,
  });
  assert.ok(problems.length >= 1);
  assert.match(problems[0].message, /not regenerated/);
});

test('no mapping for the tag is uncheckable, never a pass', () => {
  // The tri-state. Without `git ls-remote` output there is nothing to compare against, and
  // that must not read as "the lock is fine".
  const { problems, uncheckable } = verifyUiLock({
    pkgPath: pin('pkg-v130.json'),
    lockPath: pin('lock-stale-resolved.json'),
    tagCommits: { 'v1.0.7': 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
  });
  assert.deepEqual(problems, [], 'an unknown tag is not a failure');
  assert.equal(uncheckable.length, 1, 'but it must not be silent either');
  assert.match(uncheckable[0], /no commit known for v1\.3\.0/);
});

test('a lockfile with no resolved commit is a problem, not a shrug', () => {
  const { problems } = verifyUiLock({
    pkgPath: pin('pkg-v130.json'),
    lockPath: pin('lock-no-resolved.json'),
    tagCommits: TAGS,
  });
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /no resolved commit/);
});

test('a branch pin is uncheckable rather than wrong', () => {
  // Pinning a branch is a deliberate choice during development. There is no tag to compare a
  // commit to, so this says so instead of inventing a verdict.
  const { problems, uncheckable } = verifyUiLock({
    pkgPath: pin('repo-branch.json'),
    lockPath: pin('lock-good.json'),
    tagCommits: TAGS,
  });
  assert.deepEqual(problems, []);
  assert.match(uncheckable[0], /not a vX\.Y\.Z tag/);
});

test('an abbreviated sha on either side still compares equal', () => {
  const { problems } = verifyUiLock({
    pkgPath: pin('pkg-v130.json'),
    lockPath: pin('lock-good.json'),
    tagCommits: { 'v1.3.0': V130.slice(0, 7) },
  });
  assert.deepEqual(problems, [], 'a 7-char tag sha must match the 40-char resolved one');
});

test('an unreadable lockfile is uncheckable, never a pass', () => {
  const { problems, uncheckable } = verifyUiLock({
    pkgPath: pin('pkg-v130.json'),
    lockPath: pin('no-such-lock.json'),
    tagCommits: TAGS,
  });
  assert.deepEqual(problems, []);
  assert.match(uncheckable[0], /could not read/);
});

// ─── git ls-remote parsing: the annotated-tag trap ────────────────────────────
//
// `test/helpers/lib-fixtures/pins/ls-remote-tags.txt` is RECORDED from the real jdd-ui remote,
// and it is recorded because the shape is the whole point. Every jdd-ui tag is annotated, so
// each emits two rows:
//
//   c58422c…  refs/tags/v1.2.0        <- the tag object
//   16eabee…  refs/tags/v1.2.0^{}     <- the commit it points at
//
// npm records the COMMIT in `resolved`. A parser that took the first row would compare a
// tag-object sha against a commit sha and report drift for every annotated tag in the repo —
// turning a check written to catch a false green into a machine for false reds, which is the
// worse of the two. A hand-written fixture would most likely have had one row per tag and
// certified exactly that bug.

test('ls-remote parsing prefers the peeled commit over the tag object', () => {
  const tags = parseLsRemoteTags(readFileSync(pin('ls-remote-tags.txt'), 'utf8'));
  // The values npm actually puts in `resolved` — not the tag objects cb2e28d / c58422c.
  assert.equal(tags['v1.3.0'], V130, 'v1.3.0 must map to its commit, not its tag object');
  assert.equal(tags['v1.2.0'], V120);
  assert.ok(!Object.keys(tags).some((t) => t.endsWith('^{}')), 'no peel suffix should survive as a key');
});

test('the recorded remote really does use annotated tags', () => {
  // Pins the premise. If jdd-ui ever switches to lightweight tags the peel rows vanish, and
  // this says so rather than letting the preference quietly stop mattering.
  const raw = readFileSync(pin('ls-remote-tags.txt'), 'utf8');
  assert.match(raw, /refs\/tags\/v1\.3\.0\^\{\}/, 'v1.3.0 should have a peeled row');
  assert.match(raw, /^cb2e28d\w*\s+refs\/tags\/v1\.3\.0$/m, 'and a distinct tag-object row');
});

test('a lightweight tag is taken from its only row', () => {
  const tags = parseLsRemoteTags(`${V130}\trefs/tags/v9.9.9\n`);
  assert.equal(tags['v9.9.9'], V130);
});

test('a peeled row wins whichever order the rows arrive in', () => {
  // ls-remote sorts them, but nothing in the format guarantees it, and getting this backwards
  // would be invisible: the wrong sha is still a valid-looking sha.
  const reversed = `${V130}\trefs/tags/vX^{}\n${'c'.repeat(40)}\trefs/tags/vX\n`;
  assert.equal(parseLsRemoteTags(reversed)['vX'], V130);
});

test('ls-remote noise and short shas are ignored', () => {
  const tags = parseLsRemoteTags(
    ['From https://github.com/JuneauDigitalDesigns/jdd-ui.git', 'deadbeef\trefs/tags/short', ''].join('\n'),
  );
  assert.deepEqual(tags, {}, 'only full 40-char sha rows count');
});
