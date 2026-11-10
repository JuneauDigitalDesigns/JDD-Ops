// SEO plan D12 (Xander, 2026-11-10): the Google Business Profile must list the number the site
// publishes and link to the site, and it is a manual step in the console onboarding wizard ("this
// is where manual client onboarding steps are surfaced"), not a go-live checklist item. A profile
// whose phone differs from the site is a known local-ranking negative, and for a client with a
// receptionist it also routes callers around /api/voice and the agent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gbpPhase } from '../src/lib/runbook-gbp.ts';

const site = (over = {}) => ({ slug: 'peak', brandName: 'Peak Air', canonical: 'https://peakair.com', brandPhone: '(352) 555-0100', ...over });
const ctx = (sites, over = {}) => ({ slug: 'peak', brandName: 'Peak Air', isEnterprise: sites.length > 1, isWebOnly: false, sites, ...over });
const text = (phase) => JSON.stringify(phase);

test('the step names the exact phone and website the profile must carry', () => {
  const p = gbpPhase(ctx([site()]));
  assert.equal(p.group, 'onboarding');
  assert.equal(p.steps.length, 1);
  assert.ok(text(p).includes('(352) 555-0100'), 'the published phone is not in the step');
  assert.ok(text(p).includes('https://peakair.com'), 'the site URL is not in the step');
  assert.ok(!p.steps[0].auto, 'a manual to-do, not an automatic step');
});

test('an unknown phone or URL shows as pending, never a blank', () => {
  const p = gbpPhase(ctx([site({ canonical: null, brandPhone: null })]));
  assert.match(text(p), /"pending":true/);
});

test('enterprise: one step per site, each with that site\'s own number and URL', () => {
  const p = gbpPhase(ctx([site(), site({ slug: 'peak-2', brandName: 'Peak Air Ocala', canonical: 'https://ocala.peakair.com', brandPhone: '(352) 555-0199' })]));
  assert.equal(p.steps.length, 2);
  assert.ok(text(p.steps[1]).includes('(352) 555-0199') && text(p.steps[1]).includes('https://ocala.peakair.com'));
  assert.equal(p.steps[1].site, 'Peak Air Ocala');
});

test('the step tells the operator to add the profile link to the site, which feeds the footer and sameAs', () => {
  assert.match(text(gbpPhase(ctx([site()]))), /Find us on/);
});
