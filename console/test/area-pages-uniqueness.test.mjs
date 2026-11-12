// Local SEO 5b (Xander's decision L7, 2026-11-12): a town page or spoke ships only when at least
// 40% of its body comes from facts tagged to that town (and that service, for a spoke), and never
// as boilerplate with the town's name swapped in. Both are HARD: the export refuses.
//
// The 40% is measured by SOURCE, from content, not from the built HTML:
//   local     = the town's job captions and town, its review quotes, its sourced notes
//               (a spoke: the jobs and reviews tagged to both the town and the service);
//   not local = the generated intro and the links to services, however well written.
// So the model can't write its way to 40%: more generated text only lowers the share.
// The 40% is BrightLocal's figure ("40% to 60%"), not Google's; Xander adopted it as a house rule.
//
// The swapped-city detector masks every town and service name, then refuses any 8-word run that
// two town pages, two spokes, or a spoke and its service page share. It extends the service
// pages' 8-word check, which can't see "We fix AC in Minneola" vs "We fix AC in Groveland".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSite, localShare, LOCAL_SHARE_MIN } from '../src/lib/scorePage.ts';
import { buildPageSeo } from '../src/lib/pageSeo.ts';

const photo = (town, caption, extra = {}) => ({ t: '', loc: town, yr: null, scope: '', size: '', caption, image: { url: `/img/${caption.replace(/\W+/g, '')}`, alt: caption }, town, ...extra });
const review = (town, q, extra = {}) => ({ q, a: 'Dana P.', r: '', stars: 5, town, ...extra });

const base = (over = {}) => ({
  brand: { name: 'Peak Air', address: '12 Main St, Clermont, FL 34711', phone: '(352) 555-0100' },
  seo: { title: 'HVAC in Clermont | Peak Air', description: 'Home.', canonical: 'https://peakair.com' },
  services: { items: [
    { t: 'AC Repair', slug: 'ac-repair', d: 'Cool again fast.', included: ['Diagnosis', 'Refrigerant check', 'Repair'], priceFrom: '$89', page: { intro: 'We repair central air systems and heat pumps across the area. Call to book.' } },
  ] },
  extensions: { serviceArea: ['Clermont', 'Minneola', 'Groveland'], profiles: [] },
  testimonials: { items: [
    review('Minneola', 'They found the frozen coil on our old Trane and had the house cool by dinner.', { service: 'ac-repair' }),
    review('Groveland', 'Showed up early, explained the capacitor problem plainly, and cleaned up after.', { service: 'ac-repair' }),
  ] },
  work: { projects: [
    photo('Minneola', 'Condenser swap on a lakefront ranch', { service: 'ac-repair' }),
    photo('Minneola', 'New thermostat and duct sealing'),
    photo('Groveland', 'Attic air handler replaced', { service: 'ac-repair' }),
    photo('Groveland', 'Mini split for a garage workshop'),
  ] },
  faq: { items: [] },
  areaPages: [{ town: 'Minneola', slug: 'minneola', spokes: ['ac-repair'] }, { town: 'Groveland', slug: 'groveland', spokes: ['ac-repair'] }],
  areaCopy: {
    minneola: { intro: 'Peak Air works in Minneola most weeks.', spokes: { 'ac-repair': { intro: 'Need AC repair in Minneola? Call us.' } } },
    groveland: { intro: 'Groveland homes are a short drive from our shop.', spokes: { 'ac-repair': { intro: 'Our techs handle AC repair calls in Groveland too.' } } },
  },
  ...over,
});
const pages = [
  { route: '', pageType: 'home', label: 'Home', sections: [] },
  { route: 'services/ac-repair', pageType: 'service', label: 'AC Repair', sections: [] },
  { route: 'areas/minneola', pageType: 'area', label: 'Minneola', sections: [] },
  { route: 'areas/groveland', pageType: 'area', label: 'Groveland', sections: [] },
  { route: 'areas/minneola/ac-repair', pageType: 'spoke', label: 'AC Repair', sections: [] },
  { route: 'areas/groveland/ac-repair', pageType: 'spoke', label: 'AC Repair', sections: [] },
];
const hardFor = (c) => scoreSite(c, pages, buildPageSeo(c, pages, 'hvac')).hard.filter((h) => /areas\//.test(h));

test('the threshold is 40% (L7)', () => {
  assert.equal(LOCAL_SHARE_MIN, 0.4);
});

test('a town page made mostly of its own jobs and reviews passes', () => {
  const s = localShare(base(), 'areas/minneola');
  assert.ok(s.share >= 0.4, `share ${s.share}`);
  assert.ok(s.local > 0 && s.generated > 0);
  assert.deepEqual(hardFor(base()), []);
});

test('a long generated intro sinks the share below 40%: the model cannot write its way past it', () => {
  const long = 'Peak Air is proud to serve the families of Minneola with heating and cooling work that keeps every room comfortable all year long, from the first warm week of spring through the last cold snap of winter, with friendly service and clear answers every single time you call.';
  const c = base({ areaCopy: { ...base().areaCopy, minneola: { intro: long, spokes: base().areaCopy.minneola.spokes } } });
  assert.ok(localShare(c, 'areas/minneola').share < 0.4);
  assert.ok(hardFor(c).some((h) => h.includes('/areas/minneola') && /local/.test(h) && /40%/.test(h)));
});

test('a spoke counts only what is tagged to both its town and its service', () => {
  const s = localShare(base(), 'areas/minneola/ac-repair');
  // One job and one review tagged to Minneola AND ac-repair; the untagged thermostat job is not.
  assert.ok(!s.localText.includes('thermostat'));
  assert.ok(s.localText.includes('Condenser swap'));
});

test('swapped-city boilerplate is refused even when every town has its own facts', () => {
  // The town name comes at least every 7 words, so the two intros share NO 8-word run as written:
  // only masking the names shows them to be the same boilerplate.
  const same = (town) => `In ${town} we fix it. ${town} calls get a tech fast. ${town} homes stay cool.`;
  const c = base({ areaCopy: {
    minneola: { intro: same('Minneola'), spokes: base().areaCopy.minneola.spokes },
    groveland: { intro: same('Groveland'), spokes: base().areaCopy.groveland.spokes },
  } });
  assert.ok(hardFor(c).some((h) => /areas\/minneola/.test(h) && /areas\/groveland/.test(h) && /8-word/.test(h)), JSON.stringify(hardFor(c)));
});

test('a spoke may not repeat its service page with the town name swapped in', () => {
  const svcIntro = base().services.items[0].page.intro;
  const c = base({ areaCopy: { ...base().areaCopy, minneola: { intro: base().areaCopy.minneola.intro, spokes: { 'ac-repair': { intro: svcIntro.replace('across the area', 'across Minneola') } } } } });
  assert.ok(hardFor(c).some((h) => /areas\/minneola\/ac-repair/.test(h) && /services\/ac-repair/.test(h)), JSON.stringify(hardFor(c)));
});

test('town intros get the house rules too: a dash in one is refused', () => {
  const c = base({ areaCopy: { ...base().areaCopy, groveland: { intro: 'Groveland — a short drive away.', spokes: base().areaCopy.groveland.spokes } } });
  const all = scoreSite(c, pages, buildPageSeo(c, pages, 'hvac')).hard;
  assert.ok(all.some((h) => /dash/i.test(h) && h.includes('areaCopy.groveland.intro')), JSON.stringify(all));
});
