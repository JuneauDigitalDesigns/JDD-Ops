// The close wizard's card path ("Enter card", Stripe MOTO).
//
// Until Stripe approved phone payments the tab rendered "Not enabled yet". Now it drives the
// agency's card path, and two rules hold on the console's side of it. They are about what
// crosses the wire, so they are checked in the source that sends it:
//
//   - the console never handles the card: the card is typed into Stripe's Dashboard, and the
//     only thing the charge proxy forwards is the amount;
//   - the amount charged is the one the agency's preview returned (the one read aloud), sent
//     back for the agency to compare, never one the console computes or the operator types.
//
// On the code before this change the tab was a placeholder and there was no charge proxy, so
// every assertion here fails.
//
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wizard = readFileSync(new URL('../src/components/close/CloseWizard.tsx', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../src/app/api/sales/orders/[id]/charge/route.ts', import.meta.url), 'utf8');

test('the Enter card tab is live', () => {
  assert.doesNotMatch(wizard, /Not enabled yet/);
  assert.match(wizard, /method: 'dashboard-moto'/);
  assert.match(wizard, /Open customer in Stripe/);
});

test('Charge sends back the amount the agency previewed, and nothing else', () => {
  assert.match(wizard, /amountCents: preview\.amountCents/);
  // The proxy rebuilds the body from the amount alone, so nothing else can ride along.
  assert.match(proxy, /body: \{ amountCents: body\.amountCents \}/);
  assert.doesNotMatch(proxy, /body: body\b/);
});

test('the card never passes through the console', () => {
  // Card number, expiry entry and CVC are Stripe's alone. The wizard shows brand and last 4.
  for (const src of [wizard, proxy]) {
    assert.doesNotMatch(src, /cardNumber|card_number|cvc|cvv/i);
  }
});

test('the read-aloud amount and renewal are shown before Charge', () => {
  const panel = wizard.slice(wizard.indexOf('function CardPanel'));
  const shown = panel.indexOf('Renews automatically · cancel any time');
  const button = panel.indexOf('Charge {amount}');
  assert.ok(shown > 0 && button > shown, 'the renewal line comes before the Charge button');
});
