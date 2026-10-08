// Phase 11c (decision 39): a placeholder stays recognisable as a placeholder after the export
// image pipeline rewrites its slot from an images.unsplash.com URL to a local /img/<hash>. The
// detection reads _meta.local_images provenance, never the URL string, so a vertical change can
// still refresh stock while a real client photo is never touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillImagePlaceholders } from '../src/data/image-placeholders.ts';

/** The minimum SiteContent shape fillImagePlaceholders reads (it defends the rest with defaults). */
const bareContent = () => ({
  images: { hero: {}, about: {}, testimonials: {}, footer: {} },
  services: { items: [] },
  _meta: {},
});

test('a LOCALIZED placeholder is still recognised as a placeholder on re-export', () => {
  // Run once to get stock in, simulate what the pipeline does (rewrite the slot to /img/<hash> and
  // record _meta.local_images), then run AGAIN for a DIFFERENT vertical and assert the slot was
  // refreshed rather than treated as the client's own photograph.
  const first = fillImagePlaceholders(bareContent(), 'hvac');
  const hvacUrl = first.content.images.hero.portrait;
  assert.ok(first.filled.includes('images.hero.portrait'));

  const localized = {
    ...first.content,
    images: { ...first.content.images, hero: { ...first.content.images.hero, portrait: '/img/deadbeef' } },
    _meta: {
      ...first.content._meta,
      placeholder_images: first.filled,
      local_images: { [hvacUrl]: '/img/deadbeef' },
    },
  };

  const second = fillImagePlaceholders(localized, 'plumbing');
  assert.ok(
    second.filled.includes('images.hero.portrait'),
    'a localized placeholder must stay refreshable; if this fails, detection has gone back to ' +
    'string-matching the URL and stock is now permanently indistinguishable from a client photo',
  );
  assert.notEqual(second.content.images.hero.portrait, '/img/deadbeef');
});

test('a REAL client photo is never refreshed, localized or not', () => {
  // The other half of the property. A slot listed in placeholder_images whose value is NOT in
  // local_images-of-ours is the operator's own image and must survive untouched.
  const withReal = {
    ...bareContent(),
    images: { ...bareContent().images, hero: { portrait: '/img/clientphoto' } },
    _meta: { placeholder_images: ['images.hero.portrait'], local_images: { 'https://client.example/x.jpg': '/img/clientphoto' } },
  };
  const out = fillImagePlaceholders(withReal, 'plumbing');
  assert.equal(out.content.images.hero.portrait, '/img/clientphoto');
  assert.ok(!out.filled.includes('images.hero.portrait'));
});
