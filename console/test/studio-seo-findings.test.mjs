// scorePage in the Studio (SEO plan D13: "a Studio and export finding"). The export already
// scores what it ships and refuses on a hard failure; the operator should see the same findings
// before pressing Export or Deploy, not only after a refused run. seoFindings scores the Studio's
// content exactly as the export does (same pages, same preset), so the two can't disagree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seoFindings } from '../src/app/c/[slug]/build/seo-findings.ts';

const content = (over = {}) => ({
  brand: { name: 'Peak Air', phone: '(352) 555-0100', address: '12 Main St, Clermont, FL 34711', tagline: 't' },
  seo: { title: 'AC Repair in Clermont | Peak Air', description: 'd', canonical: 'https://peakair.com' },
  extensions: { serviceArea: ['Clermont'] },
  hero: { headline: 'AC repair in Clermont', sub: 'We fix it.' },
  faq: { items: [] },
  services: { items: [] },
  ...over,
});
const composition = { chrome: {}, pages: [
  { route: '', pageType: 'home', label: 'Home', sections: [{ categoryId: 'hero' }] },
  { route: 'about', pageType: 'about', label: 'About', sections: [{ categoryId: 'pageHeader' }] },
] };

test('a dash the export would refuse shows in the Studio as blocking', () => {
  const r = seoFindings(content({ hero: { headline: 'AC repair in Clermont — fast', sub: 'x' } }), composition, 'hvac');
  assert.ok(r.hard.some((h) => h.includes('hero.headline')), r.hard.join('\n'));
});

test('findings that do not block are listed apart from blocking ones', () => {
  const r = seoFindings(content(), composition, 'hvac');
  assert.deepEqual(r.hard, []);
  assert.ok(r.soft.length > 0, 'expected findings such as title length or no profile links');
});

test('a single-page site is scored as its home page', () => {
  const r = seoFindings(content({ hero: { headline: 'x near me', sub: 'y' } }), undefined, 'hvac');
  assert.ok(r.hard.some((h) => /near me/.test(h)));
});

test('both export dialogs show the panel', () => {
  for (const f of ['DeployDialog.tsx', 'LaunchDialog.tsx']) {
    const s = readFileSync(fileURLToPath(new URL(`../src/app/c/[slug]/build/${f}`, import.meta.url)), 'utf8');
    assert.match(s, /<SeoCheckPanel /, `${f} does not show the SEO check`);
  }
});

test('rendered: the blocking findings are listed; a clean site says nothing blocking', async () => {
  const React = (await import('react')).default;
  globalThis.React = React; // tsx compiles JSX to classic React.createElement calls
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: SeoCheckPanel } = await import('../src/app/c/[slug]/build/SeoCheckPanel.tsx');
  const bad = renderToStaticMarkup(React.createElement(SeoCheckPanel, { content: content({ hero: { headline: 'AC near me', sub: 'x' } }), composition, vertical: 'hvac' }));
  assert.match(bad, /SEO check · 1 blocking/);
  assert.match(bad, /near me/);
  const ok = renderToStaticMarkup(React.createElement(SeoCheckPanel, { content: content(), composition, vertical: 'hvac' }));
  assert.match(ok, /SEO check · nothing blocking · \d+ to look at/);
  assert.match(ok, /Show findings/);
});
