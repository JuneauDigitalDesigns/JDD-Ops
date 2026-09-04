import 'server-only';
import Stripe from 'stripe';
import { readOpsEnv } from './env';
import type { GoLiveResult } from './types';

/**
 * Create the LIVE Stripe webhook endpoint so subscription events reach the app. Companion to
 * stripePrices.ts and reuses the same live-key resolution: for the one-time run you add
 * STRIPE_LIVE_SECRET_KEY (or keep an sk_live_ key in STRIPE_SECRET_KEY) to jdd-ops/.env.
 *
 * The endpoint URL and the events are not guesses — they mirror exactly what
 * app/api/webhooks/stripe/route.ts branches on today:
 *   checkout.session.completed     → fulfilment / consolidation
 *   customer.subscription.updated  → plan changes
 *   customer.subscription.deleted  → featured-site cleanup
 * If you add an event.type branch to that handler, add it here too.
 *
 * The signing secret (whsec_…) is only returned by Stripe at creation. So this reuses an
 * endpoint that already targets the URL — reconciling its event list if it drifted — but
 * cannot re-read its secret; it tells you to roll the secret in the dashboard instead of
 * silently doing it (which would break the currently-deployed STRIPE_WEBHOOK_SECRET).
 *
 * The live keys (STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) stay manual copies
 * from the dashboard — there is no API to mint a full-access live secret key.
 */

const API = '2025-10-29.clover' as Stripe.LatestApiVersion;
const ENDPOINT_URL = 'https://juneaudigitaldesigns.com/api/webhooks/stripe';
const ENABLED_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

function resolveLiveKey(ops: Record<string, string>): string {
  const s = ops.STRIPE_SECRET_KEY ?? '';
  return ops.STRIPE_LIVE_SECRET_KEY || (s.startsWith('sk_live_') ? s : '');
}

/** Sorted, so drift comparison is order-independent. */
function sameEvents(a: string[], b: readonly string[]): boolean {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

export async function runStripeWebhook(dryRun: boolean): Promise<GoLiveResult> {
  const ops = readOpsEnv();
  const live = resolveLiveKey(ops);
  const events = ENABLED_EVENTS.join(', ');

  // ── Dry run ──────────────────────────────────────────────────────────────
  // Describes intent without a live key; with one, lists endpoints to say create-vs-reuse.
  if (dryRun) {
    if (!live) {
      return {
        ok: true,
        dryRun: true,
        title: 'Stripe live webhook — preview',
        summary: `Would create a live endpoint at ${ENDPOINT_URL}. Add STRIPE_LIVE_SECRET_KEY to jdd-ops/.env to run for real.`,
        lines: [`• would create → ${ENDPOINT_URL}`, `  events: ${events}`],
      };
    }
    try {
      const client = new Stripe(live, { apiVersion: API });
      const list = await client.webhookEndpoints.list({ limit: 100 });
      const existing = list.data.find((e) => e.url === ENDPOINT_URL);
      const drifted = existing && !sameEvents(existing.enabled_events, ENABLED_EVENTS);
      return {
        ok: true,
        dryRun: true,
        title: 'Stripe live webhook — preview',
        summary: existing
          ? drifted
            ? `An endpoint at ${ENDPOINT_URL} exists but its event list differs — the real run will reconcile it. The secret can't be re-read; roll it in the dashboard if you don't have it.`
            : `An endpoint at ${ENDPOINT_URL} already exists with the right events. Nothing to create.`
          : `Would create a live endpoint at ${ENDPOINT_URL} and capture STRIPE_WEBHOOK_SECRET.`,
        lines: [existing ? `• exists ${existing.id}${drifted ? ' (events drifted)' : ''}` : `• create → ${ENDPOINT_URL}`, `  events: ${events}`],
      };
    } catch (err) {
      return { ok: false, dryRun: true, error: err instanceof Error ? err.message : 'Stripe request failed.' };
    }
  }

  // ── Real run ─────────────────────────────────────────────────────────────
  if (!live) {
    return {
      ok: false,
      dryRun: false,
      error: 'No live key: add STRIPE_LIVE_SECRET_KEY to jdd-ops/.env (or keep an sk_live_ key in STRIPE_SECRET_KEY) for the real run.',
    };
  }

  try {
    const client = new Stripe(live, { apiVersion: API });
    const list = await client.webhookEndpoints.list({ limit: 100 });
    const existing = list.data.find((e) => e.url === ENDPOINT_URL);

    if (existing) {
      const drifted = !sameEvents(existing.enabled_events, ENABLED_EVENTS);
      if (drifted) {
        await client.webhookEndpoints.update(existing.id, { enabled_events: ENABLED_EVENTS });
      }
      return {
        ok: true,
        dryRun: false,
        title: 'Stripe live webhook',
        summary: `An endpoint at this URL already exists${drifted ? ' — its event list was reconciled' : ''}. Stripe only shows the signing secret at creation, so if you don't have STRIPE_WEBHOOK_SECRET, roll it in the dashboard (or delete this endpoint and re-run).`,
        lines: [`• reused ${existing.id}${drifted ? ' (events updated)' : ''} — secret not re-readable`],
      };
    }

    const created = await client.webhookEndpoints.create({
      url: ENDPOINT_URL,
      enabled_events: ENABLED_EVENTS,
      api_version: API,
    });
    if (!created.secret) {
      return { ok: false, dryRun: false, error: `Created endpoint ${created.id} but Stripe did not return a signing secret — check the Stripe dashboard.` };
    }

    return {
      ok: true,
      dryRun: false,
      title: 'Stripe live webhook',
      summary: 'Paste the signing secret into the agency env. It is shown only now — capture it before leaving this screen.',
      lines: [`✓ created ${created.id} → ${ENDPOINT_URL}`, `  events: ${events}`],
      captured: [{ label: 'STRIPE_WEBHOOK_SECRET', value: created.secret }],
    };
  } catch (err) {
    return { ok: false, dryRun: false, error: err instanceof Error ? err.message : 'Stripe webhook creation failed.' };
  }
}
