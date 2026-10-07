// The pairing registry and the two font loaders must stay in step.
//
// This is the phase's real gate, because the failure mode is SILENT: a `varName` that no loader
// maps means the stack resolves to its system fallback and the site looks like it was never
// styled. There is no error, no warning, and the build passes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_PAIRINGS, DEFAULT_PAIRING_ID, pairingFor, typographyFor, pairingIdFromStack }
  from '../src/lib/fonts.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(ROOT, '..');

test('every pairing varName is defined by BOTH loaders', () => {
  const consoleLoader = readFileSync(path.join(ROOT, 'src/lib/fonts.loader.ts'), 'utf8');
  const tplLoader = readFileSync(path.join(OPS, 'template/src/lib/fonts.loader.ts'), 'utf8');
  for (const p of FONT_PAIRINGS) {
    assert.ok(consoleLoader.includes(`'${p.varName}'`), `console loader is missing ${p.varName}`);
    assert.ok(tplLoader.includes(`'${p.varName}'`), `template loader is missing ${p.varName}`);
  }
});

test('the template loader keeps preload:false on every family', () => {
  // Measured: blanket preload cost 292KB of woff2 and 84% of a 4.2s LCP in Render Delay.
  // See the header of template/src/lib/fonts.loader.ts and PERF.md.
  const tpl = readFileSync(path.join(OPS, 'template/src/lib/fonts.loader.ts'), 'utf8');
  const families = tpl.match(/=\s*[A-Z][A-Za-z_]*\(\{[^}]*\}\)/g) ?? [];
  assert.equal(families.length, FONT_PAIRINGS.length);
  for (const f of families) assert.match(f, /preload:\s*false/, f);
});

test('the console loader deliberately does NOT set preload:false', () => {
  // The inverse assertion, so a future "let us make the two consistent" edit fails loudly.
  // The console is the picker and preview surface: every family must be resolvable at once, and
  // the bytes are an operator-machine cost, not a client-site cost.
  const con = readFileSync(path.join(ROOT, 'src/lib/fonts.loader.ts'), 'utf8');
  assert.ok(!con.includes('preload: false'), 'the console loader must not adopt preload:false');
});

test('the default pairing resolves and every id is unique', () => {
  assert.equal(pairingFor(DEFAULT_PAIRING_ID).id, DEFAULT_PAIRING_ID);
  assert.equal(pairingFor('nope').id, DEFAULT_PAIRING_ID);
  assert.equal(pairingFor(null).id, DEFAULT_PAIRING_ID);
  assert.equal(new Set(FONT_PAIRINGS.map((p) => p.id)).size, FONT_PAIRINGS.length);
  assert.ok(FONT_PAIRINGS.some((p) => p.id === 'instrument'), 'Phase 12 names this id');
});

test('typographyFor round-trips through pairingIdFromStack', () => {
  for (const p of FONT_PAIRINGS) {
    const t = typographyFor(p.id);
    assert.equal(pairingIdFromStack(t.fontSans), p.id);
    assert.equal(t.fontHeading, t.fontSans, 'decision 7: one family, two treatments');
  }
  assert.equal(pairingIdFromStack('-apple-system, sans-serif'), null);
});

test('every pairing requests only weights its family actually ships', () => {
  // Asking next/font for a weight a family does not have is a BUILD error, and the build is slow
  // to run, so catch it here. Weights are read from the installed Next font-data.json, which is
  // the same source next/font validates against.
  const data = JSON.parse(readFileSync(
    path.join(ROOT, 'node_modules/next/dist/compiled/@next/font/dist/google/font-data.json'),
    'utf8',
  ));
  // varName -> the Google family display name, matching the loaders' imports.
  const FAMILY = {
    '--font-instrument': 'Instrument Sans',
    '--font-schibsted': 'Schibsted Grotesk',
    '--font-bricolage': 'Bricolage Grotesque',
    '--font-figtree': 'Figtree',
    '--font-archivo': 'Archivo',
  };
  for (const p of FONT_PAIRINGS) {
    const family = FAMILY[p.varName];
    assert.ok(family, `no family name mapped for ${p.varName}`);
    const entry = data[family];
    assert.ok(entry, `${family} is not in the installed Next font data`);
    for (const w of [p.display.weight, p.body.weight]) {
      assert.ok(
        entry.weights.includes(String(w)),
        `${p.id}: ${family} does not ship weight ${w} (has ${entry.weights.join(', ')})`,
      );
    }
  }
});

test('the authored presets all sit on a real pairing', () => {
  // Parsed from disk rather than imported: these .ts modules carry a type-only @jdd/schema
  // import, and the schema's exports map has no `require` condition, so tsx's CJS-side
  // resolution throws ERR_PACKAGE_PATH_NOT_EXPORTED. Same approach as palette-contrast.test.mjs.
  const files = [
    'src/data/site.ts',
    'src/data/verticals/hvac.ts',
    'src/data/verticals/roofing.ts',
    'src/data/verticals/plumbing.ts',
    'src/data/verticals/lawn-care.ts',
    'src/data/verticals/car-detailing.ts',
    'src/data/verticals/health.ts',
  ];
  for (const rel of files) {
    const src = readFileSync(path.join(ROOT, rel), 'utf8');
    const m = src.match(/fontSans:\s*"([^"]*)"/);
    assert.ok(m, `${rel}: fontSans did not parse`);
    assert.ok(
      pairingIdFromStack(m[1]),
      `${rel}: fontSans "${m[1]}" matches no pairing; it would silently fall back to a system stack`,
    );
  }
});
