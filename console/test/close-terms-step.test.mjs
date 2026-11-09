// The close wizard's Terms step (Xander, 2026-11-08): two ways to accept, Read aloud and a private
// Agreement link, ending on one confirmation with the signed copy. On the code before this the
// step was the read-aloud list alone, so every assertion here fails.
//
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wizard = readFileSync(new URL('../src/components/close/CloseWizard.tsx', import.meta.url), 'utf8');
const step = wizard.slice(wizard.indexOf('function TermsStep'), wizard.indexOf('// ── Payment'));
const actions = readFileSync(new URL('../src/app/api/sales/orders/[id]/[action]/route.ts', import.meta.url), 'utf8');

test('the step opens on the two options, in neutral labels', () => {
  assert.match(step, /Terms review/);
  assert.match(step, /<b>Read aloud<\/b>/);
  assert.match(step, /<b>Agreement link<\/b>/);
  assert.doesNotMatch(step, /How would you like|Read them to me|read them myself/);
});

test('the link view has no Open link, and the client agreeing changes the whole step', () => {
  assert.doesNotMatch(step, /Open link/);
  assert.match(step, /setMode\('recorded'\)/);
  const recorded = step.slice(step.indexOf("mode === 'recorded'"), step.indexOf("mode === 'confirm'"));
  assert.match(recorded, /Agreement recorded/);
  assert.match(recorded, /setMode\('confirm'\)[^>]*>Next</);
});

test('both ways end on the confirmation, with the signed copy', () => {
  assert.match(step.slice(step.indexOf('async function accept'), step.indexOf('async function openLink')), /setMode\('confirm'\)/);
  const confirm = step.slice(step.indexOf("if (mode === 'confirm') {"));
  for (const shown of ['✓ Terms accepted', 'Accepted by', 'Method', 'Copy sent to', 'Client record', 'Accepted terms', 'Open PDF']) {
    assert.ok(confirm.includes(shown), shown);
  }
  assert.match(confirm, /agreement-pdf/);
});

test('the console can reach the link action', () => {
  assert.match(actions, /'agreement-link'/);
});
