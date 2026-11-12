// The copywriter's service-page copy (service-page-spec.md §3 blocks 3, 6 and 10, §4): for each
// service that earns its own page, an answer-first intro, "What to expect" lines from the facts,
// and 3 to 5 questions about that service only. Written to services.items[i].page, which the
// per-vertical service pages render. Only services the gate passes are ever asked for: a thin
// service gets no page, so it must get no page copy either.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCopySchema, ALL_SECTIONS } from '../src/lib/copy-schema.ts';
import { servicePagesInstruction } from '../src/lib/copy-brief/compile.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';
import { buildReviewGroups } from '../src/lib/copy-review-groups.ts';

const rich = { t: 'Drain Cleaning', slug: 'drain-cleaning', tag: 'Drains', d: 'Clear drains.', included: ['Camera inspection', 'Hydro jetting', 'Root cutting'], typicalJobs: ['Slow kitchen sink', 'Backed-up main line'], priceFrom: '$129', areas: ['Clermont'], duration: 'Under an hour' };
const thin = { t: 'Gas Lines', tag: 'Gas', d: 'Gas work.' };
const base = () => ({
  brand: { name: 'Peak Plumbing', address: '12 Main St, Clermont, FL 34711' },
  extensions: { serviceArea: ['Clermont', 'Groveland'], customerQuestions: [{ q: 'Do you clear roots?', a: '', service: 'drain-cleaning' }] },
  services: { eyebrow: '', title: '', sub: '', items: [{ ...rich }, { ...thin }] },
  testimonials: { eyebrow: '', title: '', items: [] },
  about: { eyebrow: '', title: '', body: '', pillars: [], stats: [] },
  hero: { headline: '', frictionReducers: [], heroBullets: [] },
  faq: { eyebrow: '', title: '', sub: '', items: [] },
  finalCta: { frictionReducers: [] },
});

test('servicePages is a generable section with a fixed shape', () => {
  assert.ok(ALL_SECTIONS.includes('servicePages'));
  const s = buildCopySchema(['servicePages'], false).properties.servicePages;
  const item = s.properties.items.items;
  // 2026-11-11 (service page upgrade): the About paragraphs and one line per inclusion and per sign.
  const keys = ['body', 'expect', 'faq', 'includedNotes', 'intro', 'signNotes', 'slug'];
  assert.deepEqual(Object.keys(item.properties).sort(), keys);
  assert.deepEqual(item.required.sort(), keys);
});

test('the instruction lists only services that earn a page, with their own facts and the city', () => {
  const line = servicePagesInstruction(base());
  assert.match(line, /drain-cleaning/);
  assert.ok(!/Gas Lines|gas-lines/.test(line), 'a thin service must not be asked for page copy');
  for (const fact of ['Camera inspection', 'Slow kitchen sink', '$129', 'Under an hour', 'Do you clear roots?']) {
    assert.ok(line.includes(fact), `missing fact ${fact}`);
  }
  assert.match(line, /Clermont/);
  assert.ok(!/[–—]/.test(line), 'the instruction must carry no dash');
});

test('no qualifying service, no instruction', () => {
  const c = base();
  c.services.items = [{ ...thin }];
  assert.equal(servicePagesInstruction(c), '');
});

test('generated page copy lands on the matching service by slug, and nowhere else', () => {
  const page = { intro: 'We clear drains in Clermont. Call to book.', expect: ['Most jobs take under an hour.'], faq: [{ q: 'Do you clear roots?', a: 'Yes, with a root cutter.' }] };
  const out = applyGeneratedCopy(base(), { servicePages: { items: [
    { slug: 'drain-cleaning', ...page },
    { slug: 'gas-lines', intro: 'Invented', expect: [], faq: [] },
    { slug: 'no-such-service', intro: 'x', expect: [], faq: [] },
  ] } }, new Set(['servicePages']));
  // A run that returned no body or notes stores empty lists, which render nothing.
  assert.deepEqual(out.services.items[0].page, { ...page, body: [], includedNotes: [], signNotes: [] });
  assert.equal(out.services.items[0].priceFrom, '$129', 'the client facts survive');
  assert.equal(out.services.items[1].page, undefined, 'a thin service never gets page copy, even if the model returns some');
});

test('service page copy and service card copy in one run both apply', () => {
  const out = applyGeneratedCopy(base(), {
    services: { eyebrow: 'E', title: 'T', sub: 'S', items: [{ t: 'Drain Cleaning', d: 'New card copy.', tag: 'Drains' }] },
    servicePages: { items: [{ slug: 'drain-cleaning', intro: 'Intro.', expect: [], faq: [] }] },
  }, new Set(['services', 'servicePages']));
  assert.equal(out.services.items[0].d, 'New card copy.');
  assert.equal(out.services.items[0].page.intro, 'Intro.');
});

test('each service page is reviewed for its own body copy, not only its header', () => {
  const groups = buildReviewGroups([{ route: 'services/drain-cleaning', label: 'Drain Cleaning', pageType: 'service' }]);
  const svc = groups.find((g) => g.route === 'services/drain-cleaning');
  assert.deepEqual(svc.sections, ['subpages', 'servicePages']);
});

test('generate-copy drops the section when no service earns a page', () => {
  const s = readFileSync(fileURLToPath(new URL('../src/app/api/build/generate-copy/route.ts', import.meta.url)), 'utf8');
  assert.match(s, /servicePages/);
  assert.match(s, /pickServicePages\(/);
});
