// The "Find us on" footer block (SEO plan D11, approved by Xander 2026-11-10) and the visible
// address rule for a service-area business. One list feeds both the footer links and the
// structured data's sameAs, so a profile the footer shows is exactly a profile Google is told about.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { profileLinks, siteAddress } from '../src/lib/profileLinks.ts';
import { businessNode } from '../src/lib/pageSeo.ts';

const CONSOLE = fileURLToPath(new URL('..', import.meta.url));
const OPS = join(CONSOLE, '..');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const withProfiles = (profiles, ext = {}) => ({ brand: { name: 'Peak', address: '12 Main St, Clermont, FL 34711' }, extensions: { profiles, ...ext } });

test('Google Business Profile first, then Facebook, Yelp, BBB, Angi, then the rest', () => {
  const links = profileLinks(withProfiles([
    { kind: 'instagram', url: 'https://instagram.com/peak' },
    { kind: 'yelp', url: 'https://www.yelp.com/biz/peak' },
    { kind: 'google', url: 'https://maps.app.goo.gl/abc' },
    { kind: 'angi', url: 'https://www.angi.com/companylist/us/fl/peak.htm' },
    { kind: 'facebook', url: 'https://www.facebook.com/peak' },
    { kind: 'bbb', url: 'https://www.bbb.org/us/fl/peak' },
  ]));
  assert.deepEqual(links.map((l) => l.kind), ['google', 'facebook', 'yelp', 'bbb', 'angi', 'instagram']);
  assert.equal(links[0].label, 'Google');
});

test('only real profile links: https, host matching its kind, never a Google search page', () => {
  const links = profileLinks(withProfiles([
    { kind: 'google', url: 'https://www.google.com/search?q=peak+air' },
    { kind: 'facebook', url: 'http://facebook.com/peak' },
    { kind: 'yelp', url: 'https://facebook.com/not-yelp' },
    { kind: 'other', url: 'javascript:alert(1)' },
    { kind: 'other', url: 'https://www.houzz.com/pro/peak', label: 'Houzz' },
  ]));
  assert.deepEqual(links.map((l) => `${l.kind}:${l.label}`), ['other:Houzz']);
});

test('no profiles means no links (the footer block hides itself)', () => {
  assert.deepEqual(profileLinks({ extensions: {} }), []);
  assert.deepEqual(profileLinks({}), []);
});

test('sameAs is exactly the footer list', () => {
  const c = withProfiles([{ kind: 'facebook', url: 'https://www.facebook.com/peak' }, { kind: 'google', url: 'https://www.google.com/search?q=x' }]);
  assert.deepEqual(businessNode(c, 'hvac').sameAs, profileLinks(c).map((l) => l.url));
});

test('a service-area business shows its city, never its street', () => {
  assert.equal(siteAddress(withProfiles([], { serviceAreaBusiness: true })), 'Clermont, FL 34711');
  assert.equal(siteAddress(withProfiles([], { serviceAreaBusiness: false })), '12 Main St, Clermont, FL 34711');
  assert.equal(siteAddress(withProfiles([])), '12 Main St, Clermont, FL 34711');
});

for (const f of ['src/lib/profileLinks.ts', 'src/lib/FindUsOn.tsx']) {
  test(`${f} is byte-identical in the console and the template`, () => {
    assert.equal(read(join(OPS, 'template', f)), read(join(CONSOLE, f)));
  });
}

test('every footer mounts "Find us on" and prints the address through siteAddress', () => {
  const dir = join(CONSOLE, 'src/components/catalog/footer');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.tsx'))) {
    const s = read(join(dir, f));
    assert.match(s, /<FindUsOn content=\{content\}/, `${f}: no Find us on block`);
    assert.ok(!/\{brand\.address\}/.test(s), `${f}: prints brand.address raw (a service-area business would show its street)`);
  }
  assert.match(read(join(CONSOLE, 'src/lib/FindUsOn.tsx')), />Find us on</, 'the approved heading');
  assert.match(read(join(CONSOLE, 'src/lib/FindUsOn.tsx')), /rel="me noopener"/, 'own profiles: rel="me", never nofollow');
});

test('rendered: plain links with rel="me noopener", in order, and nothing at all without profiles', async () => {
  const React = (await import('react')).default;
  const { createElement } = React;
  // tsx compiles JSX to classic React.createElement calls (see lead-form-prefill.test.mjs).
  globalThis.React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: FindUsOn } = await import('../src/lib/FindUsOn.tsx');
  const html = renderToStaticMarkup(createElement(FindUsOn, { content: withProfiles([
    { kind: 'facebook', url: 'https://www.facebook.com/peak' },
    { kind: 'google', url: 'https://maps.app.goo.gl/abc' },
  ]) }));
  assert.match(html, /Find us on/);
  assert.match(html, /<a href="https:\/\/maps\.app\.goo\.gl\/abc" rel="me noopener" target="_blank"[^>]*>Google<\/a>[\s\S]*>Facebook<\/a>/);
  assert.ok(!/nofollow/.test(html));
  assert.equal(renderToStaticMarkup(createElement(FindUsOn, { content: withProfiles([]) })), '');
});
