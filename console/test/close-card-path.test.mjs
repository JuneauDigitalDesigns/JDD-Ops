// The close wizard's card path ("Enter card", Stripe MOTO).
//
// Until Stripe approved phone payments the tab rendered "Not enabled yet". Now it drives the
// agency's card path, as a checkout the client watches on a shared screen. The rules the console
// holds are about what crosses the wire and what the client sees before money moves, so they are
// checked in the source that does it:
//
//   - the console never handles the card: it is typed into Stripe's Dashboard, the wizard only
//     asks "has a card been added?", and the charge proxy forwards nothing but the amount;
//   - the client sees the whole order (total today, what renews and when) before Subscribe, and
//     can't reach the checkout until a card is actually there;
//   - the amount charged is the one the agency previewed, sent back for it to compare.
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
const section = (from, to) => wizard.slice(wizard.indexOf(from), to ? wizard.indexOf(to) : undefined);

test('the Enter card tab is live', () => {
  assert.doesNotMatch(wizard, /Not enabled yet/);
  assert.match(wizard, /method: 'dashboard-moto'/);
  assert.match(wizard, /Add card in Stripe/);
});

test('the checkout unlocks only once Stripe says a card was added, and the wizard asks nothing more', () => {
  const flow = section('function CardFlow', 'function LockIcon');
  assert.match(flow, /\/charge\?detect=1/);
  assert.match(flow, /d\?\.cardAdded === true/);
  assert.match(flow, /disabled=\{!cardAdded \|\| busy\}[^>]*onClick=\{toCheckout\}/);
});

test('Subscribe sends back the amount the agency previewed, and nothing else', () => {
  assert.match(wizard, /amountCents: preview\.amountCents/);
  // The proxy rebuilds the body from the amount alone, so nothing else can ride along.
  assert.match(proxy, /body: \{ amountCents: body\.amountCents \}/);
  assert.doesNotMatch(proxy, /body: body\b/);
});

test('the card never passes through the console', () => {
  for (const src of [wizard, proxy]) {
    assert.doesNotMatch(src, /cardNumber|card_number|cvc|cvv/i);
  }
});

test('the whole order is on screen before Subscribe', () => {
  const checkout = section('function CardCheckout', 'function CardPaid');
  const button = checkout.indexOf("'Subscribe'");
  for (const shown of ['Total due today', 'Then {cents(preview.recurringCents)} per {unit}, starting', 'Billing details', 'Terms of Service']) {
    const at = checkout.indexOf(shown);
    assert.ok(at > 0 && at < button, `"${shown}" comes before the Subscribe button`);
  }
});
