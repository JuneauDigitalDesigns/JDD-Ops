// Catalog invariants — the regressions this rebuild actually hit, encoded so they cannot
// come back silently.
//
// Every check below corresponds to a defect that shipped, passed typecheck, passed
// `next build`, and in most cases passed Lighthouse too. They were caught by reading a
// screenshot, diffing two files by hand, or swapping a palette. That is not a repeatable
// process, so it is a test suite instead.
//
// Run: npm test   (node's built-in runner — no new dependency)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKINS } from '@jdd/ui/skins';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(ROOT, 'src/components/catalog');

/** Every catalog component file, as { name, category, rel, src }. */
function components() {
  const out = [];
  for (const cat of readdirSync(CATALOG_DIR)) {
    const dir = path.join(CATALOG_DIR, cat);
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.tsx')) continue;
      out.push({
        name: f.replace('.tsx', ''),
        category: cat,
        rel: `${cat}/${f}`,
        src: readFileSync(path.join(dir, f), 'utf8'),
      });
    }
  }
  return out;
}

const ALL = components();

test('catalog is non-empty (guards against a broken glob silently passing everything)', () => {
  assert.ok(ALL.length > 20, `expected >20 components, found ${ALL.length}`);
});

// ── The four sources that must agree ─────────────────────────────────────────
// Drift here is what let a starter client pick a variant the exporter would then reject.
test('CATALOG, the studio registry and SKINS agree', () => {
  const exportSrc = readFileSync(path.join(ROOT, 'src/lib/export.ts'), 'utf8');
  const block = /export const CATALOG[^{]*\{([\s\S]*?)\n\};/.exec(exportSrc)[1];
  const catalog = {};
  for (const m of block.matchAll(/^\s*(\w+):\s*\[([^\]]*)\]/gm)) {
    catalog[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }

  const cats = readFileSync(path.join(ROOT, 'src/app/c/[slug]/build/categories.tsx'), 'utf8');
  const registry = new Set([...cats.matchAll(/name: '(\w+)'/g)].map((m) => m[1]));

  // Imported, not regexed: src/lib/skins.ts is a re-export shim since the extraction of
  // @jdd/ui, so scraping it for a SKINS literal finds nothing. Reading the real value also
  // means this assertion cannot drift from the implementation.
  const skinNames = new Set(Object.keys(SKINS));

  for (const [cat, names] of Object.entries(catalog)) {
    for (const n of names) {
      assert.ok(existsSync(path.join(CATALOG_DIR, cat, `${n}.tsx`)), `CATALOG lists ${cat}/${n} but no file exists`);
      if (cat !== 'seo') assert.ok(registry.has(n), `CATALOG has ${n} but the studio registry does not offer it`);
    }
  }
  const inCatalog = (n) => Object.values(catalog).some((v) => v.includes(n));
  for (const n of registry) assert.ok(inCatalog(n), `studio offers ${n} but CATALOG would reject the export`);
  for (const n of skinNames) assert.ok(inCatalog(n), `SKINS lists ${n} but it is not in CATALOG`);

  // Every file on disk must be reachable, or it is dead code the studio can never show.
  for (const c of ALL) {
    assert.ok(inCatalog(c.name), `${c.rel} exists but CATALOG omits it`);
  }
});

// ── Per-component invariants ─────────────────────────────────────────────────

test('no component owns a lead form', () => {
  // Thirteen components each had their own copy. Three defects repeated in all of them,
  // including an `error` status that was set and never rendered — a failed POST showed the
  // visitor nothing and the lead was lost silently. One <LeadForm> owns this now.
  const bad = ALL.filter((c) => /fetch\(['"]\/api\/contact['"]/.test(c.src));
  assert.deepEqual(bad.map((c) => c.rel), [], 'these should use <LeadForm> from @/lib/LeadForm');
});

test('no placeholder-only inputs', () => {
  // A placeholder is not an accessible name: announced inconsistently, and gone on input.
  const bad = ALL.filter((c) => /<input[^>]*placeholder=/.test(c.src));
  assert.deepEqual(bad.map((c) => c.rel), []);
});

test('every <img> declares width and height', () => {
  // Load-bearing even when CSS sets the rendered size: it is the only intrinsic ratio
  // available before the bytes arrive. Omitting it measured CLS 0.193 on one page.
  const bad = [];
  for (const c of ALL) {
    for (const tag of c.src.match(/<img[\s\S]{0,600}?\/>/g) ?? []) {
      if (!/width=/.test(tag) || !/height=/.test(tag)) bad.push(c.rel);
    }
  }
  assert.deepEqual([...new Set(bad)], []);
});

test('no wide-tracked uppercase eyebrows', () => {
  // Cut by SPEC §3. The heading names the section and a plain sentence supports it.
  const bad = ALL.filter((c) => /tracking-\[0\.2/.test(c.src));
  assert.deepEqual(bad.map((c) => c.rel), []);
});

test('no component defaults to a retired skin name', () => {
  // The ids survive for already-exported repos, but nothing should AUTHOR them.
  const bad = ALL.filter((c) => /skin = '(editorial|contrast|quiet)'/.test(c.src));
  assert.deepEqual(bad.map((c) => c.rel), []);
});

test('no opacity applied to text sitting on the accent surface', () => {
  // The subtlest one. --accent-fg is chosen by measured contrast and is therefore guaranteed
  // legible on the accent — and then an opacity multiplier silently discards that guarantee,
  // on some palettes only. It passed on #e08b29 (5.06:1 at 80%) and failed on #E05C2A
  // (3.97:1), which is the accent the hvac preset actually ships.
  const bad = [];
  for (const c of ALL) {
    // Elements that are BOTH on an accent-filled ancestor and carry an opacity utility.
    if (!/bg-accent[^a-zA-Z0-9-]/.test(c.src)) continue;
    for (const m of c.src.matchAll(/className=[^\n]*opacity-\d+[^\n]*/g)) {
      const line = m[0];
      // Exempt from contrast requirements: disabled and hover states (WCAG applies to the
      // resting state), and anything aria-hidden.
      if (/disabled:opacity|hover:opacity|aria-hidden/.test(line)) continue;
      // Icon components are not text. The opening tag is often on an EARLIER line than the
      // className, so look back at the element rather than only at the matched line.
      const element = c.src.slice(Math.max(0, m.index - 220), m.index + line.length);
      const openTag = element.lastIndexOf('<');
      if (openTag !== -1 && /^<[A-Z]/.test(element.slice(openTag))) continue;  // <Star …/>
      if (/\bsize=\{/.test(element)) continue;
      bad.push(`${c.rel}: ${line.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, [], 'get hierarchy from size and weight, not transparency (SPEC §10a)');
});
