import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateComposition, liftLegacyToComposition, navLinksFor, routePath, navHref } from '../src/lib/pages.ts';
import { defaultCompositionFor, pageFromType, templatesFor } from '../src/app/c/[slug]/build/page-templates.tsx';

test('default composition is valid and has the 4 default pages', () => {
  const c = defaultCompositionFor();
  assert.equal(c.pages.length, 4);
  assert.equal(c.pages[0].route, '');
  assert.doesNotThrow(() => validateComposition(c));
});

test('non-home pages open with a pageHeader; home does not', () => {
  const c = defaultCompositionFor();
  const home = c.pages.find((p) => p.route === '');
  assert.ok(!home.sections.some((s) => s.categoryId === 'pageHeader'));
  for (const p of c.pages.filter((p) => p.route !== '')) {
    assert.equal(p.sections[0].categoryId, 'pageHeader');
  }
});

test('validateComposition rejects a home page carrying a pageHeader', () => {
  const c = defaultCompositionFor();
  c.pages[0].sections.unshift({ categoryId: 'pageHeader', name: 'PageHeaderSimple' });
  assert.throws(() => validateComposition(c));
});

test('pageFromType seeds an optional page from its template', () => {
  const p = pageFromType('reviews');
  assert.equal(p.route, 'reviews');
  assert.equal(p.pageType, 'reviews');
  assert.equal(p.sections[0].categoryId, 'pageHeader');
  assert.ok(templatesFor('reviews').length >= 1);
});

test('liftLegacyToComposition builds a single home page from legacy state', () => {
  const c = liftLegacyToComposition({
    selections: { nav: 'NavMinimal', footer: 'FooterColumns', seo: 'SeoLocalBusiness', hero: 'HeroSplit', services: 'ServicesGrid' },
    order: ['nav', 'hero', 'services', 'footer'],
  });
  assert.equal(c.pages.length, 1);
  assert.equal(c.pages[0].route, '');
  assert.deepEqual(c.pages[0].sections.map((s) => s.categoryId), ['hero', 'services']);
  assert.equal(c.chrome.nav.name, 'NavMinimal');
  assert.doesNotThrow(() => validateComposition(c));
});

test('navLinksFor emits route links for nav-visible pages, home first', () => {
  const links = navLinksFor(defaultCompositionFor());
  assert.equal(links[0].href, '/');
  assert.ok(links.some((l) => l.href === '/services'));
});

test('routePath / navHref map routes correctly', () => {
  assert.equal(routePath(''), 'src/app/page.tsx');
  assert.equal(routePath('services'), 'src/app/services/page.tsx');
  assert.equal(navHref(''), '/');
  assert.equal(navHref('about'), '/about');
});
