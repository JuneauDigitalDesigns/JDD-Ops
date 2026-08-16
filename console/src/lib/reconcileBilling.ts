import 'server-only';
import Stripe from 'stripe';
import type { Finding } from '@jdd/schema';
import type { PortalAccount, PortalSite } from '@jdd/schema';
import { loadStripeKey } from './opsSecrets';

/**
 * Billing findings, lifted from scripts/audit-billing.js.
 *
 * The three checks there were already correct and already argued for; this makes them
 * continuous instead of something you have to remember to run, and puts them in the same
 * list as everything else about the client. The CLI keeps working — it is the same
 * questions asked from a terminal.
 *
 * ── Stripe is READ here and WRITTEN through the portal ──────────────────────
 *
 * The console holds a restricted key and never mutates a subscription. Anything that
 * re-prices a client goes through the portal's /api/ops/plan-sync bridge, so exactly one
 * app is responsible for subscription writes. That is why every fix below points at a
 * console route that proxies, rather than at Stripe.
 *
 * An unverifiable billing state is `unknown`, never a pass — the rule audit-billing states
 * as "an unverifiable billing state must never render as a tick", and the reason it returns
 * driftSkipped rather than an empty result.
 */

let _stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const { key } = loadStripeKey();
  if (!key) return null;
  _stripe = new Stripe(key, { apiVersion: '2025-10-29.clover' as Stripe.LatestApiVersion });
  return _stripe;
}

/** Price id per tier, from jdd-ops/.env. Absent ids simply disable the drift check. */
function priceForPlan(): Record<string, string | undefined> {
  return {
    starter: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    growth: process.env.STRIPE_PRICE_GROWTH_MONTHLY,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
  };
}

/**
 * Stripe statuses that mean money is not arriving. `incomplete_expired` and `canceled` are
 * deliberately absent: those are ended relationships, not failing payments, and the stage
 * rules read them as churn rather than as risk.
 */
const TROUBLE_STATUSES = new Set(['past_due', 'unpaid', 'incomplete']);

export type SubscriptionHealth = 'active' | 'trouble' | 'ended' | null;

export interface BillingFacts {
  health: SubscriptionHealth;
  status: string | null;
  priceId: string | null;
  /** Whole cents per period, for the Account phase. Never persisted on the record. */
  amountCents: number | null;
  currentPeriodEnd: number | null;
  findings: Finding[];
}

/**
 * Billing state for ONE site, plus the findings it implies.
 *
 * Returns `health` for the stage rules as well as findings for display, because the two
 * must not disagree: deriving "at-risk" from one query and showing "payment failing" from
 * another is how a screen ends up contradicting itself.
 */
export async function reconcileBilling(
  account: PortalAccount | null,
  site: PortalSite | null,
  siteSlug: string,
  /**
   * Whether we managed to work out which account *should* own this site. Distinguishes
   * "there is no record" from "I couldn't tell which record to look at" — the first is an
   * actionable gap, the second is a blind spot on our side and must not be reported as a
   * fact about the client.
   */
  ownerResolved: boolean,
): Promise<BillingFacts> {
  const empty: BillingFacts = {
    health: null,
    status: null,
    priceId: null,
    amountCents: null,
    currentPeriodEnd: null,
    findings: [],
  };

  if (!account || !site) {
    return {
      ...empty,
      findings: [
        ownerResolved
          ? {
              id: 'portal.noRecord',
              severity: 'amber',
              area: 'portal',
              siteSlug,
              title: 'No portal record for this site',
              detail:
                'The client has no account record, so they cannot sign in, and nothing about their ' +
                'billing or usage can be checked. Attach one with `npm run link-portal`.',
            }
          : {
              id: 'portal.ownerUnresolved',
              severity: 'unknown',
              area: 'portal',
              siteSlug,
              title: 'Cannot tell which account owns this site',
              detail:
                'Neither PORTAL_ACCOUNT_EMAIL in .env.local nor a client record names the owning ' +
                'account, so billing, plan and cancellation state could not be read. The account may ' +
                'well exist — this says we could not find it, not that it is missing.',
            },
      ],
    };
  }

  const findings: Finding[] = [];
  const stripe = getStripe();

  // ── 1. Live with nothing to bill against ────────────────────────────────
  // Gated on the portal's own status, exactly as audit-billing gates it: a site still
  // building is *supposed* to have no subscription yet.
  if (site.status === 'live' && !site.stripeSubscriptionId && !site.sessionId) {
    findings.push({
      id: 'billing.unbilled',
      severity: 'red',
      area: 'billing',
      siteSlug,
      title: 'Live site with no subscription on file',
      detail:
        'This site is serving with neither a Stripe subscription nor a checkout session recorded. ' +
        'They may be being served for free, and they cannot self-serve an upgrade. Attach the ' +
        'subscription id with `npm run repair-portal`.',
    });
  }

  if (!site.stripeSubscriptionId) return { ...empty, findings };

  if (!stripe) {
    findings.push({
      id: 'billing.unchecked',
      severity: 'unknown',
      area: 'billing',
      siteSlug,
      title: 'Billing not checked',
      detail:
        'No Stripe key in jdd-ops/.env, so the subscription behind this site could not be read. ' +
        'Its plan, price and payment state are unknown — which is not the same as healthy.',
    });
    return { ...empty, findings };
  }

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(site.stripeSubscriptionId);
  } catch (err) {
    findings.push({
      id: 'billing.lookupFailed',
      severity: 'unknown',
      area: 'billing',
      siteSlug,
      title: 'Subscription lookup failed',
      detail: `Stripe could not return ${site.stripeSubscriptionId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    });
    return { ...empty, findings };
  }

  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const amountCents = item?.price?.unit_amount ?? null;

  const ended = sub.status === 'canceled' || sub.status === 'incomplete_expired';
  const health: SubscriptionHealth = ended
    ? 'ended'
    : TROUBLE_STATUSES.has(sub.status)
      ? 'trouble'
      : 'active';

  // ── 2. Payment failing ──────────────────────────────────────────────────
  if (health === 'trouble') {
    findings.push({
      id: 'billing.paymentFailing',
      severity: 'red',
      area: 'billing',
      siteSlug,
      title: `Subscription is ${sub.status}`,
      detail:
        'Stripe is not collecting. Left alone this ends in an involuntary cancellation, which reads to ' +
        'the client as you switching their service off. Usually a card that needs updating.',
      actual: sub.status,
    });
  }

  // ── 3. Plan drift ───────────────────────────────────────────────────────
  // The check that caught the incident behind audit-billing: a subscription moved to the
  // Growth price while the record stayed Starter, so the client paid more and was still
  // shown an "Upgrade" button. A cancelled subscription keeps its price and isn't drifting.
  if (!ended && priceId) {
    const prices = priceForPlan();
    const expected = prices[site.plan];
    if (!expected) {
      findings.push({
        id: 'billing.driftUnchecked',
        severity: 'unknown',
        area: 'billing',
        siteSlug,
        title: 'Plan drift not checked',
        detail: `No STRIPE_PRICE_${site.plan.toUpperCase()}_MONTHLY in jdd-ops/.env, so what they pay can't be compared to their recorded tier.`,
      });
    } else if (priceId !== expected) {
      const payingPlan =
        Object.entries(prices).find(([, id]) => id === priceId)?.[0] ?? '(unrecognised price)';
      findings.push({
        id: 'billing.planDrift',
        severity: 'red',
        area: 'billing',
        siteSlug,
        title: `Recorded as ${site.plan}, paying for ${payingPlan}`,
        detail:
          'The portal is showing this client the wrong tier, and gating features on it. Stripe is what ' +
          'they are actually charged, so the record is the thing to correct.',
        expected: `${site.plan} (${expected})`,
        actual: `${payingPlan} (${priceId})`,
        fix: {
          route: '/api/manage/plan/billing',
          body: { email: account.email, slug: siteSlug, plan: payingPlan },
          label: `Set record to ${payingPlan}`,
        },
      });
    }
  }

  // Cancellation is NOT reported here. portalSignals.ts reads the dedicated
  // `jdd:cancel-request:{slug}` record, which the portal writes the moment the client asks
  // and which carries the resolved notice period. Reporting it from both places would put
  // two rows on screen for one cancellation, and the account-record copy is the poorer of
  // the two. `site.cancelRequestedAt` is still read — by the stage rules, via the route.

  return {
    health,
    status: sub.status,
    priceId,
    amountCents,
    currentPeriodEnd: item?.current_period_end ? item.current_period_end * 1000 : null,
    findings,
  };
}
