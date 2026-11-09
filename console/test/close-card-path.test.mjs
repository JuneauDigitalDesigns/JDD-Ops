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

test('Subscribe sends back the amount the agency previewed, and at most a Stripe card id', () => {
  assert.match(wizard, /amountCents: preview\.amountCents/);
  // The proxy rebuilds the body from the amount and a pm_… id alone, so nothing else rides along.
  assert.match(proxy, /body: \{ amountCents: body\.amountCents, \.\.\.\(paymentMethodId \? \{ paymentMethodId \} : \{\}\) \}/);
  assert.match(proxy, /\/\^pm_\[A-Za-z0-9\]\{8,\}\$\//);
  assert.doesNotMatch(proxy, /body: body\b/);
});

test('the card never passes through the console', () => {
  // The proxy knows nothing about cards beyond Stripe's id.
  assert.doesNotMatch(proxy, /cardNumber|card_number|cvc|cvv|exp_month/i);
  // The wizard's card field is Stripe's own iframes; what leaves it is Stripe's pm_… id.
  const field = section('function StripeCardField', 'function LockIcon');
  assert.match(field, /elements\.create\('cardNumber'/);
  assert.match(field, /stripe\.createPaymentMethod\(/);
  assert.match(field, /\{ id: r\.paymentMethod\.id \}/);
  assert.doesNotMatch(wizard, /card_number|exp_month|cvv|\.value\b.*card/i);
});

test('with phone orders on, the card is typed in the checkout; without, the Dashboard form stays', () => {
  const flow = section('function CardFlow', 'function CardCheckout');
  assert.match(flow, /data\.cardEntry\?\.inline && data\.cardEntry\.publishableKey/);
  assert.match(flow, /setStage\('checkout'\)/);
  // Stripe refusing the phone-order flag puts the wizard back on the Dashboard form.
  assert.match(flow, /data\.code === 'moto-unavailable'[\s\S]{0,120}setStage\('entry'\)/);
  // Subscribe waits for a complete card in the field.
  assert.match(wizard, /disabled=\{busy \|\| stripeDisagrees \|\| !cardReady\}/);
});

test('the whole order is on screen before Subscribe', () => {
  const summary = section('function OrderSummary', 'function CardCheckout');
  for (const shown of ['Subtotal', 'Total due today', 'per {unit}', 'starting']) {
    assert.ok(summary.includes(shown), `the summary shows "${shown}"`);
  }
  const checkout = section('function CardCheckout', 'function CardPaid');
  const button = checkout.indexOf("'Subscribe'");
  for (const shown of ['<OrderSummary', 'Billing details', 'Terms of Service']) {
    const at = checkout.indexOf(shown);
    assert.ok(at > 0 && at < button, `"${shown}" comes before the Subscribe button`);
  }
});

// ── The payment link ────────────────────────────────────────────────────────
//
// Xander, 2026-11-08: the link view should look just like the card view, with a payment link
// where the card field is. And from the test run: once a link was copied, the panel offered only
// Switch to card and Cancel. No way to copy it again, open it or replace it, and Cancel didn't say
// it cancels the whole order. New link only appeared after the link expired.

test('the link view is the same checkout as the card view', () => {
  const link = section('function LinkCheckout', 'interface ChargePreview');
  assert.match(link, /<OrderSummary/);
  assert.match(link, /moto-checkout/);
  assert.match(link, /Billing details/);
});

test('a live link can be copied again, opened, or replaced', () => {
  const link = section('function LinkCheckout', 'interface ChargePreview');
  const live = link.slice(link.indexOf('{expired ? ('), link.indexOf('{waiting && !expired'));
  const afterExpiredBranch = live.slice(live.indexOf(') : ('));
  for (const action of ['Copy link', 'Open link', 'New link']) {
    assert.ok(afterExpiredBranch.includes(action), `${action} is offered while the link is live`);
  }
  assert.match(link, /Cancel order/);
  assert.match(wizard, /New link replaces the current one\./);
});

// ── Before the payment step ─────────────────────────────────────────────────
//
// Xander, 2026-11-04: the information steps collect information; "the only time we should see
// a dollar amount is on the payment step". The Order step showed the plan price on each chip, the
// annual price, and a "Due today / Then" panel. And a Starter close showed an "SMS registration"
// step in the stepper until the order was first saved, because the stepper read only the saved
// order and defaulted to Growth.

test('the Order step shows no amounts', () => {
  const step = section('function OrderStep', 'function TermsStep');
  assert.doesNotMatch(step, /money\(|cents\(|\$\{?\s*\d|Due today/);
});

test('the stepper follows the plan being chosen, so Starter has no SMS step from the start', () => {
  assert.match(wizard, /onPlanChange=\{setDraftPlan\}/);
  assert.match(wizard, /\(step === 'order' \? draftPlan : null\) \?\?/);
  assert.match(wizard, /closeHasSmsStep\(plan\) \? \(\['sms'\] as CloseStep\[\]\) : \[\]/);
});
