// A failed export never leaves the client's repo half-written (Xander 2026-11-12: "let's make sure
// that that never happens").
//
// What shipped: clients/_e2e_test_growth/repo after the 2026-11-11 22:13 export. It failed after
// copying the template (its src/data/site.ts reverted to the template's) and the uploaded photos
// (repo/public/images), and the repo stayed that way. An export that fails at `npm run build` also
// rewrites the composition manifest first (reconcileRoutes runs while wiring the pages).
//
// The export now writes to a staged copy (lib/stagedExport.ts) and swaps it in only after install,
// build and checks pass. These drive the real module on a temp repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beginStagedExport, stagedRepoDir, cutLinks } from '../src/lib/stagedExport.ts';

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(CONSOLE, p), 'utf8').replace(/\r\n/g, '\n');

function put(root, rel, body) {
  const p = path.join(root, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, body);
}

/** Every file under `dir` with its sha256, so "unchanged" means byte for byte. */
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[path.relative(dir, p).split(path.sep).join('/')] = createHash('sha256').update(readFileSync(p)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

/** A client folder with an exported repo, its draft beside it, as clients/_e2e_test_growth has. */
function client() {
  const root = mkdtempSync(path.join(tmpdir(), 'atomic-'));
  const repo = path.join(root, 'clients', 'demo', 'repo');
  put(repo, 'src/data/site.ts', '// console export\nexport const CONTENT = {"brand":{"name":"Demo HVAC"}};\n');
  put(repo, 'src/app/page.tsx', 'export default function Page() { return null; }\n');
  put(repo, '.studio/composition.json', '{"pages":[{"route":""}]}\n');
  put(repo, '.git/HEAD', 'ref: refs/heads/main\n');
  put(repo, 'node_modules/react/index.js', 'module.exports = {};\n');
  put(repo, '.next/BUILD_ID', 'old-build\n');
  put(root, 'clients/demo/.draft.json', '{"savedAt":1,"edits":{"work.projects":[{"image":{"url":"upload://d68f8deb-0223-40ee-b47e-296ae9f0f0b5.jpg"}}]}}');
  return { root, repo, draft: path.join(root, 'clients', 'demo', '.draft.json') };
}

/** The writes the 22:13 export made before it failed, plus the manifest a build failure rewrites. */
function halfAnExport(dir) {
  put(dir, 'src/data/site.ts', '// template placeholder\nexport const CONTENT = {"brand":{"name":"Your HVAC Co."}};\n');
  put(dir, 'public/images/d68f8deb-0223-40ee-b47e-296ae9f0f0b5.jpg', 'raw photo');
  put(dir, '.studio/composition.json', '{"pages":[{"route":""},{"route":"services"}]}\n');
  put(dir, 'node_modules/react/index.js', 'module.exports = { fresh: true };\n');
}

test('an export that fails (at the build, or anywhere) leaves the repo byte for byte as it was, and keeps the draft', () => {
  const { root, repo, draft } = client();
  try {
    const before = snapshot(repo);
    const draftBefore = readFileSync(draft, 'utf8');
    const tx = beginStagedExport(root, 'demo');
    assert.equal(stagedRepoDir('demo'), tx.stagingDir, 'repoDirFor now points every write at the staged copy');
    assert.ok(existsSync(path.join(tx.stagingDir, 'src/data/site.ts')) && existsSync(path.join(tx.stagingDir, '.git/HEAD')), 'the repo, .git included, is staged');
    assert.equal(existsSync(path.join(tx.stagingDir, 'node_modules')), false, 'node_modules is not copied: the export installs fresh');
    assert.equal(existsSync(path.join(tx.stagingDir, '.next')), false);
    halfAnExport(tx.stagingDir);
    // `npm run build` fails: the route returns, and its finally aborts.
    tx.abort();
    assert.deepEqual(snapshot(repo), before, 'not one byte of the repo changed');
    assert.equal(existsSync(tx.stagingDir), false, 'the staging copy is gone');
    assert.equal(stagedRepoDir('demo'), undefined, 'repoDirFor points at the real repo again');
    assert.equal(readFileSync(draft, 'utf8'), draftBefore, 'the draft, the only copy of the work, is kept');
    assert.deepEqual(readdirSync(path.join(root, 'clients', 'demo')).sort(), ['.draft.json', 'repo'], 'nothing left beside it');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an export that passes swaps the whole built tree in at once, and cleans up', () => {
  const { root, repo } = client();
  try {
    const tx = beginStagedExport(root, 'demo');
    halfAnExport(tx.stagingDir);
    put(tx.stagingDir, 'src/data/site.ts', '// console export\nexport const CONTENT = {"brand":{"name":"Demo HVAC","phone":"(407) 555-0177"}};\n');
    tx.commit();
    assert.match(readFileSync(path.join(repo, 'src/data/site.ts'), 'utf8'), /\(407\) 555-0177/);
    assert.equal(readFileSync(path.join(repo, '.git/HEAD'), 'utf8'), 'ref: refs/heads/main\n', 'the repo keeps its git');
    assert.match(readFileSync(path.join(repo, 'node_modules/react/index.js'), 'utf8'), /fresh/, 'the staged install comes with it');
    assert.deepEqual(readdirSync(path.join(root, 'clients', 'demo')).sort(), ['.draft.json', 'repo'], 'old tree and staging both gone');
    assert.equal(stagedRepoDir('demo'), undefined);
    tx.abort(); // the route's finally runs after a commit too: a no-op
    assert.ok(existsSync(path.join(repo, 'src/data/site.ts')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a first export that fails leaves no repo at all; one that passes creates it', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'atomic-new-'));
  try {
    mkdirSync(path.join(root, 'clients', 'fresh'), { recursive: true });
    const a = beginStagedExport(root, 'fresh');
    assert.equal(a.existed, false);
    put(a.stagingDir, 'src/data/site.ts', 'x'); // copyTemplate writes the staged path
    a.abort();
    assert.equal(existsSync(path.join(root, 'clients', 'fresh', 'repo')), false, 'no half-made repo');
    const b = beginStagedExport(root, 'fresh');
    put(b.stagingDir, 'src/data/site.ts', 'y');
    b.commit();
    assert.equal(readFileSync(path.join(root, 'clients', 'fresh', 'repo', 'src/data/site.ts'), 'utf8'), 'y');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('one export per client at a time, and a crashed run\'s leftovers are cleared', () => {
  const { root } = client();
  try {
    mkdirSync(path.join(root, 'clients', 'demo', '.repo-staging-123'), { recursive: true });
    mkdirSync(path.join(root, 'clients', 'demo', '.repo-old-123'), { recursive: true });
    const tx = beginStagedExport(root, 'demo');
    assert.throws(() => beginStagedExport(root, 'demo'), /already running/);
    assert.deepEqual(readdirSync(path.join(root, 'clients', 'demo')).filter((n) => n.endsWith('-123')), [], 'leftovers removed');
    tx.abort();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('cleanup cuts links first: a junction inside the staging copy never empties what it points at', () => {
  const { root } = client();
  const outside = mkdtempSync(path.join(tmpdir(), 'other-checkout-'));
  try {
    put(outside, 'keep.txt', 'another checkout\'s file');
    const tx = beginStagedExport(root, 'demo');
    symlinkSync(outside, path.join(tx.stagingDir, 'linked'), 'junction');
    tx.abort();
    assert.equal(readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'another checkout\'s file');
    cutLinks(outside); // no links there: a no-op
  } finally {
    rmSync(outside, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test('the export stages before its first write and swaps only after install, build and checks', () => {
  const src = read('src/app/api/build/export/route.ts');
  const at = (s) => { const i = src.indexOf(s); assert.ok(i >= 0, `missing: ${s}`); return i; };
  const order = [
    'staging = beginStagedExport(repoRoot, slug);',
    'copyTemplate(repoRoot, slug,',
    'writeSiteContent(repoRoot, slug, shipped)',
    'wirePages(repoRoot, slug,', // writes the composition manifest
    "runNpm('install', repoDir",
    "runNpm('run build', repoDir",
    'findMissingLocalImages(repoDir)',
    'staging.commit();',
    'resolveDeployTarget(repoDir)',
    'deleteDraft(slug);',
  ].map(at);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'stage, write, install, build, check, swap, then git and the draft');
  assert.match(src.slice(src.lastIndexOf('} finally {')), /staging\?\.abort\(\);/, 'every failure and early return aborts');
  assert.match(read('src/lib/export.ts'), /return stagedRepoDir\(slug\) \?\? resolve\(repoRoot, 'clients', slug, 'repo'\);/, 'every repo write goes through repoDirFor');
});
