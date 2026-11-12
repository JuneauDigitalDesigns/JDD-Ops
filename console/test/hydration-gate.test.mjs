/**
 * The Studio saved its EMPTY initial state over a client's imported site.ts under Strict Mode.
 *
 * ── The bug this encodes (2026-11-11) ───────────────────────────────────────
 *
 * BuildWizard's persist effect (declared first) was guarded by `hydrated.current`, a ref the
 * hydration effect (declared after) set to true right after `applyBundle(...)`, whose setState
 * calls had not rendered yet. `next dev` runs with `reactStrictMode: true`, so React re-ran every
 * effect of the first render once, with that render's state:
 *
 *   1. persist saw `true` and wrote the initial state (`imported: null`, a fresh savedAt) to
 *      localStorage `jdd-wizard:{slug}`, and queued it for clients/{slug}/.draft.json;
 *   2. hydration re-ran, read that bundle back, and `newerBundle` preferred it over
 *      `freshBundle(seed)`.
 *
 * A client imported from the intake queue opened on the vertical preset's sample content
 * ("Your HVAC Co.", "(555) 555-0100") and every later save carried `imported: null`. The trace
 * of jdd-wizard:{slug} on a fresh client was: get -> nothing, set imported=null,
 * get -> bundle(imported=null), set imported=null, set imported=null.
 *
 * ── How this tests it ───────────────────────────────────────────────────────
 *
 * BuildWizard itself can't render here (framer-motion, the whole Studio), so each harness below
 * has its shape: initial state empty, a persist effect declared BEFORE a hydration effect that
 * reads storage, picks with the real `newerBundle`, applies with setState and opens the gate.
 * They render with react-dom's own `createRoot` under `<StrictMode>`, which is what `next dev`
 * does. (react-test-renderer can't stand in: its build compiles Strict Mode's effect re-run out.)
 * The components render nothing, so the root needs only the few DOM stubs below.
 *
 * The first test runs the OLD ref guard and asserts the poisoning happens. That is the proof the
 * environment actually re-runs effects: without it, a pass below could mean only that Strict Mode
 * was off.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { useHydrationGate } from '../src/lib/hydrationGate.ts';
import { newerBundle } from '../src/lib/wizardBundle.ts';

// Just enough DOM for a root whose components render null: react-dom attaches its event
// listeners to the container and its document, and reads the active element around a commit.
const noop = () => {};
const doc = { nodeType: 9, addEventListener: noop, removeEventListener: noop, activeElement: null };
globalThis.window ??= { HTMLIFrameElement: class {}, document: doc };
globalThis.document ??= doc;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { act } = React;
const h = React.createElement;

const SEED = { brand: { name: 'Imported Client Co.' } };

/** localStorage stand-in that records the same trace the bug report captured. */
function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  const trace = [];
  return {
    trace,
    map,
    getItem(k) {
      const v = map.get(k) ?? null;
      trace.push(v ? `get -> bundle(imported=${JSON.parse(v).imported?.brand?.name ?? 'null'})` : 'get -> nothing');
      return v;
    },
    setItem(k, v) {
      map.set(k, v);
      trace.push(`set ${k} imported=${JSON.parse(v).imported?.brand?.name ?? 'null'}`);
    },
  };
}

const read = (storage, slug) => {
  const raw = storage.getItem(`jdd-wizard:${slug}`);
  return raw ? JSON.parse(raw) : null;
};
let clock = 1000;
const freshBundle = (seed) => ({ imported: seed });

/** BuildWizard's shape with the gate this PR adds. */
function GatedWizard({ slug, seed, draftBundle, storage, onRender }) {
  const [imported, setImported] = React.useState(null);
  const [hydrated, markHydrated] = useHydrationGate(slug);
  onRender?.({ slug, imported, hydrated });

  React.useEffect(() => {
    if (!hydrated) return;
    storage.setItem(`jdd-wizard:${slug}`, JSON.stringify({ imported, savedAt: ++clock }));
  }, [hydrated, slug, imported, storage]);

  React.useEffect(() => {
    const b = newerBundle(read(storage, slug), draftBundle) ?? freshBundle(seed);
    setImported(b.imported ?? null);
    markHydrated(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  return null;
}

/** BuildWizard's shape before this PR: the guard is a ref. */
function RefGuardedWizard({ slug, seed, draftBundle, storage }) {
  const [imported, setImported] = React.useState(null);
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    if (!hydrated.current) return;
    storage.setItem(`jdd-wizard:${slug}`, JSON.stringify({ imported, savedAt: ++clock }));
  }, [slug, imported, storage]);

  React.useEffect(() => {
    hydrated.current = false;
    const b = newerBundle(read(storage, slug), draftBundle) ?? freshBundle(seed);
    setImported(b.imported ?? null);
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  return null;
}

function mountStrict(Component, props) {
  const container = { nodeType: 1, nodeName: 'DIV', tagName: 'DIV', ownerDocument: doc, addEventListener: noop, removeEventListener: noop, textContent: '' };
  const root = createRoot(container);
  act(() => root.render(h(React.StrictMode, null, h(Component, props))));
  return root;
}

const savedImported = (storage, slug) => JSON.parse(storage.map.get(`jdd-wizard:${slug}`)).imported?.brand?.name ?? null;

test('control: the old ref guard poisons the draft under Strict Mode (the environment re-runs effects)', () => {
  const storage = makeStorage();
  mountStrict(RefGuardedWizard, { slug: 'acme', seed: SEED, draftBundle: null, storage });
  assert.equal(savedImported(storage, 'acme'), null, 'the bug as reported: imported saved as null');
  assert.ok(storage.trace.includes('get -> bundle(imported=null)'), 'hydration read back the bundle this mount wrote');
});

test('a fresh client opens with its site.ts and saves it, under Strict Mode', () => {
  const storage = makeStorage();
  const renders = [];
  mountStrict(GatedWizard, { slug: 'acme', seed: SEED, draftBundle: null, storage, onRender: (r) => renders.push(r) });

  assert.equal(savedImported(storage, 'acme'), 'Imported Client Co.');
  assert.ok(
    !storage.trace.some((t) => t.startsWith('set') && t.endsWith('imported=null')),
    `nothing may save the initial state; trace: ${storage.trace.join(' | ')}`,
  );
  const last = renders[renders.length - 1];
  assert.deepEqual([last.hydrated, last.imported?.brand?.name], [true, 'Imported Client Co.']);
  // The gate is never open in a render still showing the initial state.
  assert.ok(renders.every((r) => !r.hydrated || r.imported !== null));
});

test('a saved bundle in this browser still wins, and is not overwritten by the initial state', () => {
  const storage = makeStorage({ 'jdd-wizard:acme': { imported: { brand: { name: 'Edited Locally' } }, savedAt: 5 } });
  mountStrict(GatedWizard, { slug: 'acme', seed: SEED, draftBundle: null, storage });
  assert.equal(savedImported(storage, 'acme'), 'Edited Locally');
  assert.ok(!storage.trace.some((t) => t.startsWith('set') && t.endsWith('imported=null')), storage.trace.join(' | '));
});

test('a newer server draft still beats this browser (newerBundle is still consulted)', () => {
  const storage = makeStorage({ 'jdd-wizard:acme': { imported: { brand: { name: 'Old Local' } }, savedAt: 5 } });
  const draftBundle = { imported: { brand: { name: 'Newer Server Draft' } }, savedAt: 50 };
  mountStrict(GatedWizard, { slug: 'acme', seed: SEED, draftBundle, storage });
  assert.equal(savedImported(storage, 'acme'), 'Newer Server Draft');
});

test("a slug change on the same mount never saves one client's state under the next one's key", () => {
  const storage = makeStorage({ 'jdd-wizard:b': { imported: { brand: { name: 'Client B' } }, savedAt: 5 } });
  const root = mountStrict(GatedWizard, { slug: 'a', seed: SEED, draftBundle: null, storage });
  act(() => {
    root.render(h(React.StrictMode, null, h(GatedWizard, { slug: 'b', seed: null, draftBundle: null, storage })));
  });
  assert.equal(savedImported(storage, 'b'), 'Client B');
  assert.ok(!storage.trace.includes('set jdd-wizard:b imported=Imported Client Co.'), storage.trace.join(' | '));
});

test('BuildWizard guards its saves with the gate, not a ref', async () => {
  // The harnesses above are BuildWizard's shape, not BuildWizard. This pins the real file to it.
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/app/c/[slug]/build/BuildWizard.tsx', import.meta.url), 'utf8');
  assert.match(src, /const \[hydrated, markHydrated\] = useHydrationGate\(slug\);/);
  assert.match(src, /markHydrated\(slug\);/);
  assert.doesNotMatch(src, /hydrated\.current/, 'a ref guard reads open before the loaded state has rendered');
  // Every effect that saves or reshapes state checks the gate: the draft, the brief, the
  // service-page sync and the town-page sync (local SEO, 2026-11-12).
  assert.equal(src.match(/if \(!hydrated\) return;/g)?.length, 4);
});
