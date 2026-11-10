// No em-dash or en-dash in anything a visitor or the copywriter reads (Xander, 2026-11-10: SEO plan
// D5, all four layers, and D6: ranges are written "1 to 2"). One client's home page carried 17.
// They came from four places, each guarded here or in its own test:
//   1. the copywriter's prompt text, which the model copies   → compile.ts / compile-brief.ts below
//   2. the model's own output                                  → copy-brief/dash-guard.ts (dash-guard.test.mjs)
//   3. fixed template text, presets and seeds                  → catalog, data/ below
//   4. what an export would ship                               → scorePage (score-page.test.mjs)
// Comments are exempt: they are never rendered and never sent to the model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONSOLE = fileURLToPath(new URL('..', import.meta.url));
const ROOT = join(CONSOLE, '..');
// The characters, and their HTML entities: JSX renders &mdash; as an em-dash, and two Lawn lines
// carried one that the character-only check missed (found 2026-11-10).
const DASH = /[–—]|&(mdash|ndash|#8212|#8211|#x2014|#x2013);/i;

/** Source with comments removed: block comments (incl. JSX {/* *\/}) and line comments that are
 *  not part of a URL ("https://"). Strings keep their text. */
export function stripComments(src) {
  return src
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')
    .split(/\r?\n/) // CRLF working copies: `.` never matches "\r", so a line comment would survive
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n');
}

function walk(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (ext.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

function dashLines(file) {
  const hits = [];
  stripComments(readFileSync(file, 'utf8')).split(/\r?\n/).forEach((line, i) => {
    if (DASH.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
  return hits;
}

const GROUPS = {
  'prompt text the copywriter reads': [
    join(CONSOLE, 'src/lib/copy-brief/compile.ts'),
    join(CONSOLE, 'src/lib/copy-brief/compile-brief.ts'),
  ],
  'catalog components (fixed template text)': walk(join(CONSOLE, 'src/components/catalog'), ['.tsx', '.ts']),
  'vertical presets and the default seed': [
    ...walk(join(CONSOLE, 'src/data/verticals'), ['.ts']),
    join(CONSOLE, 'src/data/site.ts'),
    join(ROOT, 'template/src/data/site.ts'),
  ],
  'shared site libraries (StickyCallBar, LeadForm wrappers)': walk(join(CONSOLE, 'src/lib'), ['.tsx']),
};

for (const [label, files] of Object.entries(GROUPS)) {
  test(`no em- or en-dash in ${label}`, () => {
    const hits = files.flatMap(dashLines);
    assert.deepEqual(hits, [], `dashes found:\n${hits.join('\n')}`);
  });
}

test('entity dashes count as dashes', () => {
  assert.ok(DASH.test('a flat quote &mdash; usually') && DASH.test('1&ndash;2') && !DASH.test('a-b'));
});

test('stripComments keeps strings and URLs, drops comments', () => {
  const src = "const a = 'x — y'; // note — here\r\n/* block — */ const u = 'https://e.com';\r\n{/* jsx — */}";
  const out = stripComments(src);
  assert.ok(out.includes("'x — y'"), 'string text must survive');
  assert.ok(out.includes('https://e.com'), 'URL must survive');
  assert.ok(!out.includes('note'), 'line comment must go');
  assert.ok(!out.includes('block'), 'block comment must go');
  assert.ok(!out.includes('jsx'), 'JSX comment must go');
});
