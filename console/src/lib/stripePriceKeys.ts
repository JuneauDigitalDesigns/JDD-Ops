/**
 * Every Stripe price the agency sells on, named once: each plan × monthly, annual and onboarding.
 *
 * The go-live price copier, env sync, preflight and the go-live wizard's env rows each used to
 * carry their own hand-written list, and each fell behind as the price set grew. The copier
 * covered 4 of the 9 (no annual prices, and onboarding for Starter only, a leftover of Starter
 * once being the only plan with an onboarding fee), so going live would have left annual
 * checkout and the Growth/Enterprise onboarding fee pointing at test-mode prices. Deriving every
 * list from this one means a new plan or kind is added in exactly one place.
 *
 * Pure, with no `server-only`, so the test can import it.
 */

export const PRICE_TIERS = ['starter', 'growth', 'enterprise'] as const;
export const PRICE_KINDS = ['monthly', 'annual', 'onboarding'] as const;

export type PriceTier = (typeof PRICE_TIERS)[number];
export type PriceKind = (typeof PRICE_KINDS)[number];

export interface PriceKeySpec {
  /** The env var that holds the price id, e.g. `STRIPE_PRICE_GROWTH_ANNUAL`. */
  key: string;
  tier: PriceTier;
  kind: PriceKind;
}

export function priceKey(tier: PriceTier, kind: PriceKind): string {
  return `STRIPE_PRICE_${tier.toUpperCase()}_${kind.toUpperCase()}`;
}

export const STRIPE_PRICE_SPECS: readonly PriceKeySpec[] = PRICE_TIERS.flatMap((tier) =>
  PRICE_KINDS.map((kind) => ({ key: priceKey(tier, kind), tier, kind })),
);

export const STRIPE_PRICE_KEYS: readonly string[] = STRIPE_PRICE_SPECS.map((s) => s.key);
