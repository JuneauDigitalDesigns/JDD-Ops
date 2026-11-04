/**
 * Which Stripe price belongs to which plan, monthly and annual.
 *
 * Pure, and kept apart from `reconcileBilling.ts` so a test can run the real rule. The drift
 * check used to know only the MONTHLY price for each tier, so every annual client — billed
 * exactly right, on the annual price — was reported as "Recorded as growth, paying for
 * (unrecognised price)", a red finding that says the portal is gating them on the wrong tier.
 */

export interface PlanPriceIds {
  monthly?: string;
  annual?: string;
}

export type PlanPriceMap = Record<string, PlanPriceIds>;

/** The tier prices from jdd-ops/.env. Absent ids simply narrow what can be checked. */
export function planPricesFromEnv(env: Record<string, string | undefined>): PlanPriceMap {
  return {
    starter: { monthly: env.STRIPE_PRICE_STARTER_MONTHLY, annual: env.STRIPE_PRICE_STARTER_ANNUAL },
    growth: { monthly: env.STRIPE_PRICE_GROWTH_MONTHLY, annual: env.STRIPE_PRICE_GROWTH_ANNUAL },
    enterprise: { monthly: env.STRIPE_PRICE_ENTERPRISE_MONTHLY, annual: env.STRIPE_PRICE_ENTERPRISE_ANNUAL },
  };
}

/** Every configured price for a plan, either billing period. */
export function pricesFor(map: PlanPriceMap, plan: string): string[] {
  const p = map[plan];
  return p ? [p.monthly, p.annual].filter((id): id is string => Boolean(id)) : [];
}

/** The plan a price bills, monthly or annual, or null for a price we don't sell. */
export function planForPrice(map: PlanPriceMap, priceId: string): string | null {
  for (const [plan, ids] of Object.entries(map)) {
    if (ids.monthly === priceId || ids.annual === priceId) return plan;
  }
  return null;
}
