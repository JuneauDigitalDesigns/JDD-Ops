/**
 * The composition manifest, and the page deletion it exists to prevent.
 *
 * ── The bug this encodes ────────────────────────────────────────────────────
 *
 * The exporter used to recover "what did I write last time" by regex-parsing home's
 * `page.tsx` back into the flat legacy `{selections, order}` shape. That shape has no concept
 * of a second page, and the parser reads one file. So a four-page client reopened in the
 * Studio came back as a ONE-page composition — and the next export wrote one page file and
 * had the prune step DELETE `src/app/services`, `/about` and `/contact`.
 *
 * A four-page site silently became a one-page site, every subpage 404'd, and the only clue was
 * the live URL. The manifest removes the inference: the exporter is told what it did, not left
 * to deduce it.
 *
 * Never imports ../src/lib/export.ts — it pulls in `server-only` and @jdd/schema, neither of
 * which resolves under the tsx test loader (the standing convention in this directory). The
 * route reconciliation that export.ts calls lives in composition-manifest.ts for exactly that
 * reason, so `reconcileRoutes` here IS the code the exporter runs, not a restatement of it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readCompositionManifest,
  writeCompositionManifest,
  reconcileRoutes,
  previousRoutes,
  manifestPath,
  legacyRoutesPath,
} from '../src/lib/composition-manifest.ts';
import { defaultCompositionFor } from '../src/app/c/[slug]/build/page-templates.tsx';

const OPS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A throwaway client repo. */
function makeRepo() {
  return mkdtempSync(resolve(tmpdir(), 'jdd-manifest-'));
}

/** Stand in for what wirePages writes, so the prune has real directories to act on. */
function placePages(repoDir, comp) {
  for (const page of comp.pages) {
    const dir = page.route === '' ? resolve(repoDir, 'src', 'app') : resolve(repoDir, 'src', 'app', ...page.route.split('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'page.tsx'), 'export default () => null;\n');
  }
}

const routeExists = (repoDir, route) => existsSync(resolve(repoDir, 'src', 'app', ...route.split('/'), 'page.tsx'));

test('the manifest round-trips to the same composition', () => {
  const repoDir = makeRepo();
  try {
    const comp = defaultCompositionFor();
    writeCompositionManifest(repoDir, comp);

    const back = readCompositionManifest(repoDir);
    assert.ok(back, 'a manifest must be readable after being written');
    assert.deepEqual(
      back.pages.map((p) => p.route),
      comp.pages.map((p) => p.route),
      'every page must survive the round trip — losing one is how the subpages were deleted',
    );
    assert.deepEqual(
      back.pages.map((p) => p.sections.map((s) => s.name)),
      comp.pages.map((p) => p.sections.map((s) => s.name)),
    );
    assert.equal(back.chrome.nav.name, comp.chrome.nav.name);
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('re-exporting the composition read back from the manifest keeps every route', () => {
  // The regression in its purest form. Before the manifest, the second export is where the
  // collapse happened, because the composition had been re-derived from home's page.tsx in
  // between — and that derivation could only ever describe one page.
  const repoDir = makeRepo();
  try {
    const first = defaultCompositionFor();
    placePages(repoDir, first);
    reconcileRoutes(repoDir, first);

    const reopened = readCompositionManifest(repoDir);
    assert.equal(reopened.pages.length, 4, 'reopening must not collapse the site');

    const { pruned } = reconcileRoutes(repoDir, reopened);
    assert.deepEqual(pruned, [], 'an unchanged composition must delete nothing');
    for (const route of ['services', 'about', 'contact']) {
      assert.ok(routeExists(repoDir, route), `/${route} was deleted by a re-export of the same composition`);
    }
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('dropping a page prunes exactly that route and no other', () => {
  const repoDir = makeRepo();
  try {
    const comp = defaultCompositionFor();
    placePages(repoDir, comp);
    reconcileRoutes(repoDir, comp);

    const trimmed = defaultCompositionFor();
    trimmed.pages = trimmed.pages.filter((p) => p.route !== 'about');
    const { pruned } = reconcileRoutes(repoDir, trimmed);

    assert.deepEqual(pruned, ['about']);
    assert.ok(!existsSync(resolve(repoDir, 'src', 'app', 'about')), 'the dropped route must be pruned');
    assert.ok(routeExists(repoDir, 'services'));
    assert.ok(routeExists(repoDir, 'contact'));
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('home is never prunable, even from a manifest that somehow lists it', () => {
  // '' resolves to src/app. Pruning it would delete the entire application.
  const repoDir = makeRepo();
  try {
    const comp = defaultCompositionFor();
    placePages(repoDir, comp);
    mkdirSync(resolve(repoDir, '.studio'), { recursive: true });
    writeFileSync(legacyRoutesPath(repoDir), JSON.stringify(['', 'about']) + '\n');

    const onlyHome = defaultCompositionFor();
    onlyHome.pages = onlyHome.pages.filter((p) => p.route === '');
    reconcileRoutes(repoDir, onlyHome);

    assert.ok(existsSync(resolve(repoDir, 'src', 'app')), 'src/app must survive');
    assert.ok(routeExists(repoDir, ''), 'home page.tsx must survive');
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('the legacy .studio-pages.json still drives pruning on the first manifest export', () => {
  // Without this fallback, a client that drops a page in the very export that introduces the
  // manifest keeps the dropped page's directory, and Next goes on serving it.
  const repoDir = makeRepo();
  try {
    const comp = defaultCompositionFor();
    placePages(repoDir, comp);
    mkdirSync(resolve(repoDir, 'src', 'app', 'reviews'), { recursive: true });
    writeFileSync(resolve(repoDir, 'src', 'app', 'reviews', 'page.tsx'), 'export default () => null;\n');
    writeFileSync(legacyRoutesPath(repoDir), JSON.stringify(['reviews']) + '\n');

    assert.deepEqual(previousRoutes(repoDir), ['reviews'], 'the legacy file must be read when no manifest exists');

    const { pruned } = reconcileRoutes(repoDir, comp);
    assert.deepEqual(pruned, ['reviews']);
    assert.ok(!existsSync(resolve(repoDir, 'src', 'app', 'reviews')));
    assert.ok(!existsSync(legacyRoutesPath(repoDir)), 'the superseded state file must be removed');
    assert.ok(existsSync(manifestPath(repoDir)));
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('nested service routes prune correctly', () => {
  // Decision 20 generates `services/<slug>` pages. A prune that split on the wrong separator
  // would either miss them or aim at the wrong directory.
  const repoDir = makeRepo();
  try {
    const comp = defaultCompositionFor();
    comp.pages.push({
      route: 'services/ac-repair',
      pageType: 'service',
      label: 'AC Repair',
      templateId: 'service-standard',
      navVisible: false,
      sections: [
        { categoryId: 'pageHeader', name: 'PageHeaderSimple', id: 's_h' },
        { categoryId: 'finalCta', name: 'FinalCtaBanner', id: 's_c' },
      ],
    });
    placePages(repoDir, comp);
    reconcileRoutes(repoDir, comp);
    assert.ok(routeExists(repoDir, 'services/ac-repair'));

    const trimmed = defaultCompositionFor();
    const { pruned } = reconcileRoutes(repoDir, trimmed);
    assert.deepEqual(pruned, ['services/ac-repair']);
    assert.ok(!existsSync(resolve(repoDir, 'src', 'app', 'services', 'ac-repair')));
    assert.ok(routeExists(repoDir, 'services'), 'the parent services page must survive');
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('an unreadable or future-version manifest reads as null rather than throwing', () => {
  // The caller's fallback is the lossy page parser. Throwing here would take the whole Studio
  // page down over a corrupt file, which is a much worse outcome than degrading.
  const repoDir = makeRepo();
  try {
    mkdirSync(resolve(repoDir, '.studio'), { recursive: true });

    writeFileSync(manifestPath(repoDir), 'not json at all');
    assert.equal(readCompositionManifest(repoDir), null);

    writeFileSync(manifestPath(repoDir), JSON.stringify({ version: 999, composition: defaultCompositionFor() }));
    assert.equal(readCompositionManifest(repoDir), null, 'a future version must not be parsed optimistically');

    writeFileSync(manifestPath(repoDir), JSON.stringify({ version: 1, composition: { pages: [] } }));
    assert.equal(readCompositionManifest(repoDir), null, 'a composition with no pages is not usable');
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('sections read back from a manifest always carry stable ids', () => {
  // sectionStyles keys off these; a section without one is treated as unstyled, so a manifest
  // written before ids existed would silently drop per-section styling on reopen.
  const repoDir = makeRepo();
  try {
    const comp = defaultCompositionFor();
    for (const p of comp.pages) for (const s of p.sections) delete s.id;
    writeCompositionManifest(repoDir, comp);

    const back = readCompositionManifest(repoDir);
    for (const p of back.pages) for (const s of p.sections) assert.ok(s.id, 'every section needs an id');
  } finally {
    rmSync(repoDir, { recursive: true, force: true });
  }
});

test('wirePages reconciles routes through the manifest, not an inference', () => {
  // The link this file cannot exercise directly. If export.ts stops calling reconcileRoutes,
  // everything above still passes while the exporter goes back to deriving its prior state.
  const src = readFileSync(resolve(OPS_ROOT, 'console/src/lib/export.ts'), 'utf8');
  assert.match(src, /reconcileRoutes\s*\(/, 'wirePages must reconcile routes via the manifest module');
  assert.doesNotMatch(src, /\.studio-pages\.json/, 'export.ts must no longer hand-roll the legacy state file');
});

test('the Studio page prefers the manifest over the page parser', () => {
  // Order of preference is the whole fix. Reading the parser first would keep collapsing
  // multi-page clients on reopen even with a perfectly good manifest sitting in the repo.
  const src = readFileSync(resolve(OPS_ROOT, 'console/src/app/c/[slug]/build/page.tsx'), 'utf8');
  assert.match(src, /readCompositionManifest\s*\(/);
  assert.ok(
    src.indexOf('readCompositionManifest(') < src.indexOf('readStudioComposition('),
    'the manifest must be read before the lossy fallback',
  );
});

test('the manifest is not hidden from git by the template gitignore', () => {
  // An ignored manifest would be absent on exactly the fresh-clone path it exists to serve —
  // which is the original reason the lossy page parser was written in the first place.
  const ignore = readFileSync(resolve(OPS_ROOT, 'template', '.gitignore'), 'utf8');
  for (const line of ignore.split(/\r?\n/)) {
    const pattern = line.trim();
    if (!pattern || pattern.startsWith('#')) continue;
    assert.ok(
      !'.studio/composition.json'.startsWith(pattern.replace(/\/$/, '')),
      `template/.gitignore pattern "${pattern}" would exclude the composition manifest`,
    );
  }
});
