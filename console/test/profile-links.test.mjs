// The "Find us on" footer block (SEO plan D11, "Find us on" approved word for word by Xander
// 2026-11-10) and the visible address rule for a service-area business.
//
// ONE list, lib/serviceLinks.ts profileLinks (byte-identical in console and template, a twin
// test pins that), feeds every footer's block and the structured data's sameAs, so a profile the
// footer shows is exactly a profile Google is told about. It used to accept any https URL under
// any kind; it now also needs a host that matches the kind, refuses Google search pages and drops
// duplicates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { profileLinks, displayAddress } from '../src/lib/serviceLinks.ts';
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

test('only real profile links: https, host matching its kind, never a Google search page, no duplicates', () => {
  const links = profileLinks(withProfiles([
    { kind: 'google', url: 'https://www.google.com/search?q=peak+air' },
    { kind: 'facebook', url: 'http://facebook.com/peak' },
    { kind: 'yelp', url: 'https://facebook.com/not-yelp' },
    { kind: 'other', url: 'javascript:alert(1)' },
    { kind: 'other', url: 'https://www.houzz.com/pro/peak', label: 'Houzz' },
    { kind: 'other', url: 'https://www.houzz.com/pro/peak', label: 'Houzz again' },
  ]));
  assert.deepEqual(links.map((l) => `${l.kind}:${l.label}`), ['other:Houzz']);
});

test('no profiles means no links (every footer block hides itself)', () => {
  assert.deepEqual(profileLinks({ extensions: {} }), []);
  assert.deepEqual(profileLinks({}), []);
});

test('sameAs is exactly the footer list', () => {
  const c = withProfiles([{ kind: 'facebook', url: 'https://www.facebook.com/peak' }, { kind: 'google', url: 'https://www.google.com/search?q=x' }]);
  assert.deepEqual(businessNode(c, 'hvac').sameAs, profileLinks(c).map((l) => l.url));
});

test('a service-area business shows its city, never its street', () => {
  assert.equal(displayAddress(withProfiles([], { serviceAreaBusiness: true })), 'Clermont, FL 34711');
  assert.equal(displayAddress(withProfiles([])), '12 Main St, Clermont, FL 34711');
});

test('lib/FindUsOn.tsx is byte-identical in the console and the template', () => {
  assert.equal(read(join(OPS, 'template/src/lib/FindUsOn.tsx')), read(join(CONSOLE, 'src/lib/FindUsOn.tsx')));
});

test('every footer has a "Find us on" block and never prints brand.address raw', () => {
  const dir = join(CONSOLE, 'src/components/catalog/footer');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.tsx'))) {
    const s = read(join(dir, f));
    // A vertical footer carries its own block (template-visual-upgrade); a generic one mounts FindUsOn.
    const own = /const FIND_US_ON = 'Find us on';/.test(s) && /profileLinks\(content\)/.test(s);
    assert.ok(own || /<FindUsOn content=\{content\}/.test(s), `${f}: no Find us on block reading profileLinks`);
    // Printing brand.address is fine only behind `address === brand.address ?`, where address is
    // displayAddress(content): the raw field stays editable in the Studio when it has no street to hide.
    const unguarded = s.replace(/address === brand\.address \? <E p="brand\.address">\{brand\.address\}<\/E>/g, '');
    assert.ok(!/\{brand\.address\}/.test(unguarded), `${f}: prints brand.address raw (a service-area business would show its street)`);
  }
  const shared = read(join(CONSOLE, 'src/lib/FindUsOn.tsx'));
  assert.match(shared, />Find us on</);
  assert.match(shared, /rel="me noopener"/, 'own profiles: rel="me", never nofollow');
  assert.match(shared, /from '@\/lib\/serviceLinks'/, 'the generic block reads the one list');
});

test('rendered: plain links with rel="me noopener", in order, and nothing at all without profiles', async () => {
  const React = (await import('react')).default;
  // tsx compiles JSX to classic React.createElement calls (see lead-form-prefill.test.mjs).
  globalThis.React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: FindUsOn } = await import('../src/lib/FindUsOn.tsx');
  const html = renderToStaticMarkup(React.createElement(FindUsOn, { content: withProfiles([
    { kind: 'facebook', url: 'https://www.facebook.com/peak' },
    { kind: 'google', url: 'https://maps.app.goo.gl/abc' },
  ]) }));
  assert.match(html, /Find us on/);
  assert.match(html, /<a href="https:\/\/maps\.app\.goo\.gl\/abc" rel="me noopener" target="_blank"[^>]*>Google<\/a>[\s\S]*>Facebook<\/a>/);
  assert.ok(!/nofollow/.test(html));
  assert.equal(renderToStaticMarkup(React.createElement(FindUsOn, { content: withProfiles([]) })), '');
});
