// Footer chrome links on multi-page sites — the dead-anchor bug that shipped on
// _e2e_test_starter (https://e2eteststarter.vercel.app): footer.cols links were single-page
// `#anchor`s, so on a 4-page site `#about`/`#services`/… scrolled to nothing from every page
// that didn't host the section. The exporter now remaps them to the route that carries the
// section (and refuses an export whose footer points at a section on no page).
//
// Import the REAL resolution functions the export route wires in (route.ts can't be imported
// here — it's server-only + @jdd/schema), and drive them against compositions shaped like the
// ones the Studio actually produces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anchorCategory,
  bestRouteForCategory,
  servicePageRouteForLabel,
  resolveChromeHref,
  remapFooterCols,
} from '../src/app/c/[slug]/build/nav-targets.ts';

/** A page with just the fields the resolver reads. */
const page = (route, pageType, cats) => ({
  route,
  pageType,
  label: pageType,
  templateId: `${pageType}-test`,
  navVisible: route !== '' ? true : true,
  sections: cats.map((categoryId) => ({ categoryId, name: `${categoryId}X` })),
});

/** The live _e2e_test_starter composition (from its .studio/composition.json). */
function liveComposition() {
  return {
    chrome: {
      nav: { categoryId: 'nav', name: 'NavMinimal' },
      footer: { categoryId: 'footer', name: 'FooterColumns' },
      seo: { categoryId: 'seo', name: 'SeoLocalBusiness' },
    },
    pages: [
      page('', 'home', ['hero', 'trust', 'differentiators', 'services', 'testimonials', 'faq', 'contact']),
      page('services', 'services', ['pageHeader', 'services', 'faq', 'finalCta']),
      page('about', 'about', ['pageHeader', 'about', 'trust', 'testimonials', 'finalCta']),
      page('contact', 'contact', ['pageHeader', 'contact', 'faq', 'finalCta']),
    ],
  };
}

const footer = (cols) => ({ blurb: '', cols, social: [], legalLinks: [], legal: '' });

test('anchorCategory maps section anchors and ignores non-section hrefs', () => {
  assert.equal(anchorCategory('#services'), 'services');
  assert.equal(anchorCategory('#cta'), 'finalCta');
  assert.equal(anchorCategory('  #about '), 'about');
  assert.equal(anchorCategory('#top'), null); // deliberately unpoliced (nav-targets header)
  assert.equal(anchorCategory('#'), null);
  assert.equal(anchorCategory('https://example.com'), null);
});

test('footer anchors remap to the route that carries each section (the shipped bug)', () => {
  const comp = liveComposition();
  const { cols, dangling } = remapFooterCols(
    footer([
      { h: 'Services', links: [{ label: 'HVAC Installation', href: '#services' }] },
      { h: 'Company', links: [
        { label: 'About Us', href: '#about' },
        { label: 'Reviews', href: '#testimonials' },
        { label: 'FAQ', href: '#faq' },
        { label: 'Contact Us', href: '#cta' },
      ] },
    ]),
    comp,
  );
  assert.deepEqual(dangling, []);
  assert.equal(cols[0].links[0].href, '/services#services'); // owner page
  assert.equal(cols[1].links[0].href, '/about#about');       // owner page
  assert.equal(cols[1].links[1].href, '/#testimonials');     // no reviews page → home carries it
  assert.equal(cols[1].links[2].href, '/#faq');              // no faq page → home carries it
  assert.equal(cols[1].links[3].href, '/contact#cta');       // finalCta is owned by contact
});

test('a footer service link deep-links to its per-service page, else falls back to /services', () => {
  const comp = liveComposition();
  comp.pages.push(page('services/hvac-repair', 'service', ['pageHeader', 'services']));

  // slug of the label matches the generated services/<slug> route → deep link
  assert.equal(servicePageRouteForLabel('HVAC Repair', comp), 'services/hvac-repair');
  assert.equal(resolveChromeHref('#services', 'HVAC Repair', comp), '/services/hvac-repair');

  // label that names no service page → fall back to the services listing page
  assert.equal(servicePageRouteForLabel('Not A Service', comp), null);
  assert.equal(resolveChromeHref('#services', 'Not A Service', comp), '/services#services');
});

test('a link to a section on NO page is dangling; adding the section resolves it', () => {
  const comp = liveComposition(); // has no `work` section and no gallery page
  assert.equal(bestRouteForCategory('work', comp), null);

  const withWork = footer([{ h: 'Company', links: [{ label: 'Our Work', href: '#work' }] }]);
  const r1 = remapFooterCols(withWork, comp);
  assert.equal(r1.dangling.length, 1);
  assert.equal(r1.dangling[0].href, '#work');
  assert.equal(r1.dangling[0].col, 'Company');
  assert.equal(r1.cols[0].links[0].href, '#work'); // left unchanged for the export to refuse

  // Add a gallery page (which carries `work`) and the same link resolves.
  comp.pages.push(page('gallery', 'gallery', ['pageHeader', 'work']));
  const r2 = remapFooterCols(withWork, comp);
  assert.deepEqual(r2.dangling, []);
  assert.equal(r2.cols[0].links[0].href, '/gallery#work');
});

test('single-page sites keep their anchors (they still scroll within the one page)', () => {
  const comp = {
    chrome: liveComposition().chrome,
    pages: [page('', 'home', ['hero', 'services', 'about', 'finalCta'])],
  };
  assert.equal(resolveChromeHref('#services', 'Services', comp), '#services');
  const { cols, dangling } = remapFooterCols(
    footer([{ h: 'Company', links: [{ label: 'About', href: '#about' }] }]),
    comp,
  );
  assert.deepEqual(dangling, []);
  assert.equal(cols[0].links[0].href, '#about');
});
