// Xander, 2026-11-12: "There's also no way to add or remove individual services on the services
// step. Removing services from here should warn with a modal. Especially if the service was
// provided by a client from their onboarding wizard that they fill out." Approved as the canvas's
// row 5 ("Approve, build them").
//
// What a removal must not break: tags hold a service's SLUG, and slugs are derived in order with
// "-2" for a repeat, so removing one service can move another's slug and silently re-point its
// photos, questions and reviews. Tagged items are the client's real material: kept, untagged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { serviceSlugs } from '@jdd/schema';
import { removalPlan, removeService, serviceFromClient, removalRows } from '../src/lib/service-remove.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const content = () => ({
  services: {
    items: [
      { t: 'AC repair', d: '', tag: 'Cooling', page: { intro: 'Page copy', body: [] } },
      { t: 'Heat pump service', d: '', tag: 'Heating' },
      { t: 'AC repair', d: '', tag: 'Cooling' },
    ],
  },
  work: { projects: [
    { t: 'AC repair', caption: 'Coil', service: 'ac-repair' },
    { t: 'AC repair', caption: 'Unit', service: 'ac-repair' },
    { t: 'Second', caption: 'Other', service: 'ac-repair-2' },
  ] },
  extensions: { customerQuestions: [{ q: 'Saturdays?', a: 'Yes', service: 'ac-repair' }, { q: 'Untagged', a: '' }] },
  testimonials: { items: [{ q: 'Great', a: 'Ann', service: 'ac-repair' }, { q: 'Fine', a: 'Bo', service: 'heat-pump-service' }] },
});

test('removing a service keeps its photos, questions and reviews, untagged', () => {
  const w = removeService(content(), 0);
  assert.deepEqual(w['services.items'].map((i) => i.t), ['Heat pump service', 'AC repair']);
  assert.deepEqual(w['work.projects'].map((p) => p.service), [undefined, undefined, 'ac-repair-2']);
  assert.equal(w['work.projects'].length, 3);
  assert.deepEqual(w['extensions.customerQuestions'], [{ q: 'Saturdays?', a: 'Yes' }, { q: 'Untagged', a: '' }]);
  assert.deepEqual(w['testimonials.items'].map((t) => t.service), [undefined, 'heat-pump-service']);
});

test('another service keeps its slug, so its tags still point at it', () => {
  const c = content();
  const w = removeService(c, 0);
  const after = { ...c, services: { items: w['services.items'] }, work: { projects: w['work.projects'] } };
  // The second "AC repair" was ac-repair-2 and must stay so: its photo is tagged ac-repair-2.
  assert.deepEqual(serviceSlugs(after), ['heat-pump-service', 'ac-repair-2']);
  assert.equal(w['services.items'][1].slug, 'ac-repair-2');
  assert.equal(w['services.items'][0].slug, undefined, 'a slug that does not move is left as it was');
});

test('only lists that changed are written', () => {
  const w = removeService(content(), 1);
  assert.ok(!('work.projects' in w));
  assert.ok(!('extensions.customerQuestions' in w));
  assert.ok('testimonials.items' in w);
});

test('the plan counts what goes and what stays', () => {
  const p = removalPlan(content(), 0, { ownPage: true });
  assert.deepEqual(p, { name: 'AC repair', slug: 'ac-repair', ownPage: true, pageCopy: true, photos: 2, questions: 1, reviews: 1 });
  assert.deepEqual(removalRows(p), [
    ['Service page', '/services/ac-repair, removed'],
    ['Page copy', 'Removed'],
    ['Photos', '2 kept in Work, untagged'],
    ['Customer questions', '1 kept, untagged'],
    ['Reviews', '1 kept, untagged'],
  ]);
  assert.deepEqual(removalRows(removalPlan(content(), 1, { ownPage: false })), [
    ['Service page', 'None'],
    ['Photos', 'None'],
    ['Customer questions', 'None'],
    ['Reviews', '1 kept, untagged'],
  ]);
});

test('a service is the client\'s when their onboarding form listed it', () => {
  const form = { services: { items: [{ t: 'AC Repair ' }] }, _meta: { brandDirection: { tone: 'plain' } } };
  const close = { services: { items: [{ t: 'AC repair' }] }, _meta: {} };
  assert.equal(serviceFromClient(form, { t: 'ac repair' }), true);
  assert.equal(serviceFromClient(form, { t: 'Duct cleaning' }), false);
  assert.equal(serviceFromClient(close, { t: 'AC repair' }), false, 'a close seeds the preset, not the client\'s list');
  assert.equal(serviceFromClient(null, { t: 'AC repair' }), false);
});

test('the step has add and remove, and the client\'s service needs the tick', () => {
  const src = readFileSync(path.join(ROOT, 'src/components/wizard/intake/ServicesStep.tsx'), 'utf8');
  for (const s of ['Add service', 'Remove service', 'Cancel', 'Listed by the client on the onboarding form.', 'Remove a service the client listed']) {
    assert.ok(src.includes(s), s);
  }
  assert.match(src, /disabled=\{fromClient && !confirmed\}/);
  assert.match(src, /removeService\(content, /);
});
