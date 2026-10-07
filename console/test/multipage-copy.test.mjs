import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCopySchema, ALL_SECTIONS } from '../src/lib/copy-schema.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';

test('ALL_SECTIONS includes the subpages section', () => {
  assert.ok(ALL_SECTIONS.includes('subpages'));
});

test('buildCopySchema surfaces about.story, services item detail, and subpages.items', () => {
  const s = buildCopySchema(['about', 'services', 'subpages'], false);
  assert.ok(s.properties.about.properties.story, 'about.story missing');
  assert.ok(
    s.properties.services.properties.items.items.properties.detail,
    'services item detail missing',
  );
  assert.ok(s.properties.subpages.properties.items, 'subpages.items missing');
});

test('applyGeneratedCopy maps story, detail, and subpages into SiteContent', () => {
  const base = {
    about: { eyebrow: '', title: '', body: '', pillars: [], stats: [] },
    services: { eyebrow: '', title: '', sub: '', items: [{ n: '01', t: 'A', d: 'd', tag: 't' }] },
  };
  const copy = {
    about: { story: ['p1', 'p2'] },
    services: { items: [{ detail: 'more detail' }] },
    subpages: {
      items: [
        { route: 'services', eyebrow: 'e', title: 'T', sub: 's', seoTitle: 'st', seoDescription: 'sd' },
        { route: 'contact', eyebrow: 'e', title: 'T', sub: 's', ctaLabel: 'Call', ctaHref: '/x', seoTitle: 'st2', seoDescription: 'sd2' },
      ],
    },
  };
  const g = applyGeneratedCopy(base, copy, new Set(['about', 'services', 'subpages']));

  assert.deepEqual(g.about.story, ['p1', 'p2']);
  assert.equal(g.services.items[0].detail, 'more detail');
  // cta only survives when BOTH label and href are present
  assert.equal(g.subpages.services.header.cta, null);
  assert.deepEqual(g.subpages.contact.header.cta, { label: 'Call', href: '/x' });
  assert.equal(g.subpages.services.seo.title, 'st');
  assert.equal(g.subpages.contact.seo.description, 'sd2');
});

test('applyGeneratedCopy leaves subpages untouched when not requested', () => {
  const base = { about: { eyebrow: '', title: '', body: '', pillars: [], stats: [] } };
  const g = applyGeneratedCopy(base, { subpages: { items: [{ route: 'x' }] } }, new Set(['about']));
  assert.equal(g.subpages, undefined);
});
