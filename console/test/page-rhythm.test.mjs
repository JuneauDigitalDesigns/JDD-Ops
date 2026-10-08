// PAGE-LEVEL invariants. Everything here is a property of a WHOLE PAGE, which is why it cannot
// live in catalog-invariants.test.mjs: a component cannot see the page it is placed on, and that
// is exactly why decision 24 puts rhythm at the template level rather than inside components.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_TEMPLATES } from '../src/app/c/[slug]/build/page-templates.tsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(ROOT, 'src/components/catalog');

/** component name -> meta.signature, read from the file rather than restated. */
const SIGNATURE = new Map();
for (const cat of readdirSync(CATALOG_DIR)) {
  for (const f of readdirSync(path.join(CATALOG_DIR, cat))) {
    if (!f.endsWith('.tsx')) continue;
    const src = readFileSync(path.join(CATALOG_DIR, cat, f), 'utf8');
    SIGNATURE.set(f.replace('.tsx', ''), /signature:\s*true/.test(src));
  }
}

test('the template registry is non-empty (guards a broken import passing everything)', () => {
  // Without this, an import that silently yields [] would make every test below vacuously true.
  assert.ok(PAGE_TEMPLATES.length > 0, 'PAGE_TEMPLATES is empty');
  assert.ok(SIGNATURE.size > 0, 'no catalog components were read');
});

test('at most one inverted section per page (decision 12)', () => {
  // "One dark anchor section per page, maximum." Two dark bands on one page stops either of them
  // being an anchor, and the page reads as striped rather than as having a centre of gravity.
  for (const t of PAGE_TEMPLATES) {
    const inverted = t.sections.filter((s) => s.skin === 'inverted');
    assert.ok(inverted.length <= 1,
      `${t.id} has ${inverted.length} inverted sections: ${inverted.map((s) => s.name).join(', ')}`);
  }
});

test('at most two signature motion moments per page (decision 26)', () => {
  // Decision 26 TIGHTENS the old rule from one-per-section to one-or-two-per-PAGE. Research §5:
  // the premium signal is not more animation, it is fewer, better-executed moments.
  // Micro-reveals (reveal/revealItem/revealStagger) are free and are not counted.
  for (const t of PAGE_TEMPLATES) {
    const sig = t.sections.filter((s) => SIGNATURE.get(s.name) === true);
    assert.ok(sig.length <= 2,
      `${t.id} places ${sig.length} signature components: ${sig.map((s) => s.name).join(', ')}`);
  }
});

// Un-skipped in Phase 9, which added `rhythm` to SectionRef and set it on every template.
test('section rhythm is never uniform (decision 30d)', () => {
  for (const t of PAGE_TEMPLATES) {
    const rhythms = t.sections.map((s) => s.rhythm);
    assert.ok(rhythms.every(Boolean), `${t.id}: every section needs an explicit rhythm`);
    assert.ok(new Set(rhythms).size >= 3,
      `${t.id}: only ${new Set(rhythms).size} distinct rhythms. Research §6 item 8 names uniform ` +
      `section rhythm as an AI-sameness tell and decision 30(d) bans it.`);
    for (let i = 2; i < rhythms.length; i++) {
      assert.ok(!(rhythms[i] === rhythms[i - 1] && rhythms[i] === rhythms[i - 2]),
        `${t.id}: three consecutive '${rhythms[i]}' sections at index ${i - 2}`);
    }
  }
});
