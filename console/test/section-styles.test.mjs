import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureSectionIds, styleKeyFor, newSectionId } from '../src/lib/pages.ts';
import { defaultCompositionFor, applyTemplate, pageFromType, templatesFor, PAGE_TEMPLATES } from '../src/app/c/[slug]/build/page-templates.tsx';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// NOTE: wirePages' generated-code output (the sectionVars wrapper) is verified by tsc + an actual
// client export/build rather than here — export.ts transitively imports `server-only`, which the
// tsx test runner can't load. These tests cover the pure composition + template layer.

test('newSectionId produces distinct ids', () => {
  const a = newSectionId(), b = newSectionId();
  assert.notEqual(a, b);
  assert.match(a, /^s_/);
});

test('applyTemplate / pageFromType stamp a unique id on every section', () => {
  const p = pageFromType('services');
  const ids = p.sections.map((s) => s.id);
  assert.ok(ids.every(Boolean), 'every section has an id');
  assert.equal(new Set(ids).size, ids.length, 'ids are unique within a page');

  const tmpl = templatesFor('about')[0];
  const applied = applyTemplate(p, tmpl);
  assert.ok(applied.sections.every((s) => s.id), 'applyTemplate stamps ids too');
  // Re-applying mints fresh ids (a template swap is a structural reset).
  const reapplied = applyTemplate(applied, tmpl);
  assert.notDeepEqual(reapplied.sections.map((s) => s.id), applied.sections.map((s) => s.id));
});

test('styleKeyFor: body sections key by id, chrome by slot', () => {
  assert.equal(styleKeyFor({ id: 's_abc', categoryId: 'hero', name: 'HeroSplit' }), 's_abc');
  assert.equal(styleKeyFor({ categoryId: 'nav', name: 'NavMinimal' }), 'nav');
  assert.equal(styleKeyFor({ categoryId: 'footer', name: 'FooterColumns' }), 'footer');
});

test('ensureSectionIds backfills ids idempotently', () => {
  const raw = {
    chrome: defaultCompositionFor().chrome,
    pages: [{ route: '', pageType: 'home', label: 'Home', templateId: 'x', navVisible: true, sections: [{ categoryId: 'hero', name: 'HeroSplit' }] }],
  };
  const once = ensureSectionIds(raw);
  const id = once.pages[0].sections[0].id;
  assert.ok(id, 'id assigned');
  const twice = ensureSectionIds(once);
  assert.equal(twice.pages[0].sections[0].id, id, 'existing ids are preserved');
});

test('default composition sections all carry stable ids', () => {
  const c = defaultCompositionFor();
  for (const p of c.pages) {
    assert.ok(p.sections.every((s) => s.id), `page ${p.route || 'home'} sections all have ids`);
  }
});

test('core non-home pages each have three templates (Phase 9 added a third per core type)', () => {
  for (const [pt, expectId] of [['services', 'services-panel'], ['about', 'about-proof'], ['contact', 'contact-overlap']]) {
    const list = templatesFor(pt);
    assert.equal(list.length, 3, `${pt} has three templates`);
    assert.ok(list.some((t) => t.id === expectId), `${pt} includes ${expectId}`);
  }
  // Home now has three (standard/bold/quiet); per-service pages have two; optional 5th pages one.
  assert.equal(templatesFor('home').length, 3);
  assert.equal(templatesFor('service').length, 2);
  assert.equal(templatesFor('reviews').length, 1);
  assert.equal(templatesFor('gallery').length, 1);
  assert.equal(templatesFor('areas').length, 1);
});

test('every template section references a real catalog component', () => {
  // Derived from the real CATALOG in export.ts (read, not imported: export.ts pulls server-only)
  // so this cannot go stale as the catalog grows, which is exactly what the old hardcoded snapshot
  // did when waves 1 and 2 landed.
  const exportSrc = readFileSync(path.join(ROOT, 'src/lib/export.ts'), 'utf8');
  const block = /export const CATALOG[^{]*\{([\s\S]*?)\n\};/.exec(exportSrc)[1];
  const CATALOG_NAMES = new Set([...block.matchAll(/'([A-Za-z0-9]+)'/g)].map((m) => m[1]));
  assert.ok(CATALOG_NAMES.size > 30, 'parsed the catalog name set');
  for (const t of PAGE_TEMPLATES) {
    for (const s of t.sections) {
      assert.ok(CATALOG_NAMES.has(s.name), `${t.id} references unknown component ${s.name}`);
    }
  }
});

test('non-home templates open with a pageHeader; the new ones included', () => {
  for (const t of PAGE_TEMPLATES.filter((t) => t.pageType !== 'home')) {
    assert.equal(t.sections[0].categoryId, 'pageHeader', `${t.id} opens with a pageHeader`);
  }
});
