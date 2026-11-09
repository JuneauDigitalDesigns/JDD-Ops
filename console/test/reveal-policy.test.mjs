/**
 * Sections animate in as the visitor scrolls, on every client site.
 *
 * What shipped (2026-11-09): `_e2e_test_growth` went live on the HVAC template with no animate-in
 * at all. The generic catalog components carry their own framer-motion reveals; the sixty bespoke
 * vertical components (Hvac*, Roofing*, Lawn*, Plumbing*, Detail*) carry none, and a vertical
 * template uses only those. The exporter now marks the sections that need one, and the template's
 * globals.css animates them.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REVEAL_CLASS, SELF_ANIMATED, revealsOnScroll } from '../src/lib/revealPolicy.ts';
import { applyVerticalTemplate } from '../src/app/c/[slug]/build/vertical-templates.tsx';

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(CONSOLE, '..');
const CATALOG = path.join(CONSOLE, 'src/components/catalog');
const read = (p) => readFileSync(p, 'utf8');

test('the self-animated list is exactly the components that bring their own motion', () => {
  const scanned = [];
  for (const cat of readdirSync(CATALOG, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    for (const f of readdirSync(path.join(CATALOG, cat.name))) {
      if (!f.endsWith('.tsx')) continue;
      const src = read(path.join(CATALOG, cat.name, f));
      if (/from 'framer-motion'|from '@\/lib\/motion'/.test(src)) scanned.push(f.replace(/\.tsx$/, ''));
    }
  }
  assert.deepEqual([...SELF_ANIMATED].sort(), scanned.sort());
});

test('every page of the HVAC template reveals its sections below the first, and never the opening', () => {
  const comp = applyVerticalTemplate('hvac');
  for (const page of comp.pages) {
    page.sections.forEach((ref, i) => {
      const expected = i > 0 && !['hero', 'pageHeader'].includes(ref.categoryId);
      assert.equal(revealsOnScroll(ref, i), expected, `${page.route || 'home'} · ${ref.name} at ${i}`);
    });
    assert.ok(page.sections.some((ref, i) => revealsOnScroll(ref, i)), `${page.route || 'home'} gets at least one reveal`);
  }
});

test('a component with its own entrance is not revealed twice, and the first section never animates', () => {
  assert.equal(revealsOnScroll({ categoryId: 'services', name: 'ServicesPanel' }, 2), false);
  assert.equal(revealsOnScroll({ categoryId: 'services', name: 'HvacServices' }, 2), true);
  assert.equal(revealsOnScroll({ categoryId: 'services', name: 'HvacServices' }, 0), false);
  assert.equal(revealsOnScroll({ categoryId: 'hero', name: 'HvacHero' }, 1), false);
});

test('the exporter and the Studio preview put the same class on the same sections', () => {
  const exporter = read(path.join(CONSOLE, 'src/lib/export.ts'));
  assert.match(exporter, /lines\.push\(\.\.\.emit\(`<\$\{ref\.name\}\$\{skinAttr\(ref\)\} \/>`, ref, revealsOnScroll\(ref, i\)\)\);/);
  assert.match(exporter, /reveal \? REVEAL_CLASS : ''/);
  const studio = read(path.join(CONSOLE, 'src/app/c/[slug]/build/PageStudio.tsx'));
  assert.match(studio, /reveal=\{chromeSlot === null && revealsOnScroll\(ref, i - 1\)\}/);
});

test('the reveal CSS is in the template and the console, guarded for support and reduced motion', () => {
  // Line endings normalised BEFORE searching: on a Windows checkout git writes these files with
  // CRLF, and an end marker of '\n}\n' never matched there (the test passed in CI and failed on
  // the operator's machine, 530/531, after #41).
  const block = (raw) => {
    const css = raw.replace(/\r\n/g, '\n');
    const start = css.indexOf('@keyframes rv-in');
    if (start < 0) return '';
    const end = css.indexOf('\n}\n', css.indexOf('@supports (animation-timeline: view())', start));
    return end < 0 ? '' : css.slice(start, end + 2);
  };
  const template = block(read(path.join(OPS, 'template/src/styles/globals.css')));
  const consoleCss = block(read(path.join(CONSOLE, 'src/app/globals.css')));
  assert.ok(template.length > 50, 'found in the template');
  assert.equal(consoleCss, template, 'the preview animates the way the site will');
  assert.match(template, new RegExp(`\\.${REVEAL_CLASS} \\{ animation: rv-in`));
  assert.match(template, /@media \(prefers-reduced-motion: no-preference\)/, 'reduced motion sees the section, unanimated');
  assert.match(template, /@supports \(animation-timeline: view\(\)\)/, 'no support, no hidden section');
});
