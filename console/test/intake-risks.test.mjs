// SEO plan D2 (Xander, 2026-11-10): "Warn loudly at the end of the intake wizard before we move
// onto the build wizard." client-seo's copyRisks finds preset sample copy and claims the facts
// don't support; the intake groups them by claim and section and jumps to where each is fixed.
// A warning only: Approve is never blocked by it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { copyRisks } from '../src/lib/copyRisks.ts';
import { claimGroups, presetGroups, riskTarget, pathLabel } from '../src/lib/intake-risks.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const preset = {
  hero: { headline: 'Fast, friendly HVAC service', sub: 'Same-day repairs, licensed and insured techs.' },
  faq: { items: [{ q: 'Do you offer free estimates?', a: 'Yes, every estimate is free.' }] },
};
const content = {
  brand: { license: '' },
  hero: { headline: 'Fast, friendly HVAC service', sub: 'Same-day repairs, licensed and insured techs.' },
  services: { items: [{ t: 'AC Repair', d: 'Backed by our satisfaction guarantee.' }] },
  faq: { items: [{ q: 'Do you offer free estimates?', a: 'Yes, every estimate is free.' }] },
  extensions: {},
};

test('claims are grouped by claim, biggest first; each row jumps to where it is fixed', () => {
  const risks = copyRisks(content, preset);
  const groups = claimGroups(risks);
  const keys = groups.map((g) => g.key);
  for (const k of ['same day', 'licensed', 'insured', 'guarantee']) assert.ok(keys.includes(k), k);
  const guarantee = groups.find((g) => g.key === 'guarantee');
  assert.deepEqual(guarantee.rows[0].target, { step: 'services', serviceIndex: 0 });
  const sameDay = groups.find((g) => g.key === 'same day');
  assert.deepEqual(sameDay.rows[0].target, { step: 'review', section: 'hero' });
});

test('preset copy is grouped by section, in page order', () => {
  const groups = presetGroups(copyRisks(content, preset));
  assert.deepEqual(groups.map((g) => g.key), ['hero', 'faq']);
  assert.equal(groups[0].rows.length, 2);
});

test('targets: a service field opens that service, a subpage header its route, the rest its section', () => {
  assert.deepEqual(riskTarget('services.items.3.detail'), { step: 'services', serviceIndex: 3 });
  assert.deepEqual(riskTarget('subpages.about.header.title'), { step: 'review', section: 'subpages', route: 'about' });
  assert.deepEqual(riskTarget('finalCta.sub'), { step: 'review', section: 'finalCta' });
  assert.equal(pathLabel('faq.items.0.a'), 'FAQ · 1 a');
});

test('the warning is loud and never blocks Approve', () => {
  const src = readFileSync(path.join(ROOT, 'src/components/wizard/intake/TodoStep.tsx'), 'utf8');
  assert.match(src, /role="alert"/);
  // Approve is disabled only by the copy-review gate, never by risks.
  const approve = src.slice(src.indexOf('onClick={onApprove}'), src.indexOf('Approve · open Studio'));
  assert.match(approve, /disabled=\{blocked\}/);
  assert.doesNotMatch(approve, /risk/i);
  const step = readFileSync(path.join(ROOT, 'src/components/wizard/IntakeStep.tsx'), 'utf8');
  assert.match(step, /copyRisks\(effective, presetFor\(vertical\)\)/);
});
