import { NextResponse } from 'next/server';
import {
  financeSettingsConfigured,
  getFinanceSettings,
  resetFinanceSettings,
  saveFinanceSettings,
} from '@/lib/financeSettings';
import { TY2026_SETTINGS, type FinanceSettings, type TaxBracket } from '@/lib/financeTypes';
import { guardLocal } from '@/lib/financeGuard';
import { loadStripeKey } from '@/lib/opsSecrets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KV_HINT =
  'Finances storage not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in ' +
  'console/.env.local (the same pair the lead queue uses).';

/**
 * GET — current settings, plus which Stripe key is in play.
 *
 * `stripeConfigured` / `stripeRestricted` are booleans derived from the key. The key itself is
 * never in a response body — same contract as the rest of opsSecrets.ts. Knowing a RESTRICTED
 * key is in use is genuinely useful on screen (it's the recommended posture for a console with
 * no auth); knowing the key is not.
 */
export async function GET(req: Request) {
  const gate = guardLocal(req);
  if (gate) return gate;

  const { key, restricted } = loadStripeKey();

  if (!financeSettingsConfigured()) {
    return NextResponse.json(
      {
        settings: TY2026_SETTINGS,
        persisted: false,
        stripeConfigured: Boolean(key),
        stripeRestricted: restricted,
        error: KV_HINT,
      },
      { status: 200 },
    );
  }

  try {
    return NextResponse.json({
      settings: await getFinanceSettings(),
      persisted: true,
      stripeConfigured: Boolean(key),
      stripeRestricted: restricted,
    });
  } catch (e) {
    console.error('[/api/finances/settings] read failed', e);
    return NextResponse.json(
      {
        settings: TY2026_SETTINGS,
        persisted: false,
        stripeConfigured: Boolean(key),
        stripeRestricted: restricted,
        error: 'Could not read settings; showing the built-in defaults.',
      },
      { status: 200 },
    );
  }
}

/** Whole, non-negative cents. Zero is allowed here — a $0 standard deduction is a valid setting. */
function validCents(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1_000_000_000_00;
}
/** A rate expressed as a fraction. Capped at 1 so a "15.3" typed for 0.153 is rejected loudly. */
function validRate(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

const CENTS_FIELDS = [
  'standardDeductionCents',
  'ssWageBaseCents',
  'qbiThresholdCents',
  'qbiMinimumCents',
  'qbiEligibilityFloorCents',
  'additionalMedicareThresholdCents',
] as const;

const RATE_FIELDS = [
  'seBaseMultiplier',
  'seSocialSecurityRate',
  'seMedicareRate',
  'additionalMedicareRate',
  'qbiRate',
  'stateIncomeTaxRate',
] as const;

/**
 * PUT — save an edit, or restore the verified defaults with `{ action: 'reset' }`.
 *
 * Validation is strict about types because every field here multiplies straight into the tax
 * figure. A rate arriving as the string "0.124", or a percentage typed as 15.3 where a fraction
 * was meant, would produce a confidently wrong number rather than an error — so both are rejected
 * at the boundary instead of coerced.
 */
export async function PUT(req: Request) {
  const gate = guardLocal(req);
  if (gate) return gate;
  if (!financeSettingsConfigured()) {
    return NextResponse.json({ error: KV_HINT }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (body.action === 'reset') {
    try {
      return NextResponse.json({ settings: await resetFinanceSettings() });
    } catch (e) {
      console.error('[/api/finances/settings] reset failed', e);
      return NextResponse.json({ error: 'Could not restore defaults.' }, { status: 500 });
    }
  }

  const patch: Partial<FinanceSettings> = {};

  for (const f of CENTS_FIELDS) {
    if (body[f] === undefined) continue;
    if (!validCents(body[f])) {
      return NextResponse.json(
        { error: `${f} must be a whole number of cents.` },
        { status: 400 },
      );
    }
    patch[f] = body[f] as number;
  }

  for (const f of RATE_FIELDS) {
    if (body[f] === undefined) continue;
    if (!validRate(body[f])) {
      return NextResponse.json(
        { error: `${f} must be a fraction between 0 and 1 (12.4% is 0.124, not 12.4).` },
        { status: 400 },
      );
    }
    patch[f] = body[f] as number;
  }

  if (body.taxYear !== undefined) {
    const y = body.taxYear;
    if (typeof y !== 'number' || !Number.isInteger(y) || y < 2000 || y > 2100) {
      return NextResponse.json({ error: 'taxYear must be a four-digit year.' }, { status: 400 });
    }
    patch.taxYear = y;
  }

  if (body.categories !== undefined) {
    if (!Array.isArray(body.categories) || body.categories.some((c) => typeof c !== 'string')) {
      return NextResponse.json({ error: 'categories must be an array of strings.' }, { status: 400 });
    }
    if (body.categories.length === 0) {
      return NextResponse.json({ error: 'Keep at least one category.' }, { status: 400 });
    }
    patch.categories = body.categories as string[];
  }

  if (body.brackets !== undefined) {
    if (!Array.isArray(body.brackets) || body.brackets.length === 0) {
      return NextResponse.json({ error: 'brackets must be a non-empty array.' }, { status: 400 });
    }
    const rows: TaxBracket[] = [];
    for (const raw of body.brackets) {
      const b = raw as Partial<TaxBracket>;
      if (!validCents(b.overCents) || !validCents(b.baseCents) || !validRate(b.rate)) {
        return NextResponse.json(
          { error: 'Each bracket needs whole-cent overCents and baseCents, and a 0–1 rate.' },
          { status: 400 },
        );
      }
      rows.push({ overCents: b.overCents, baseCents: b.baseCents, rate: b.rate });
    }
    // The table must start at zero, or income below the first edge would fall through untaxed.
    rows.sort((a, b) => a.overCents - b.overCents);
    if (rows[0].overCents !== 0) {
      return NextResponse.json(
        { error: 'The first bracket must start at $0.' },
        { status: 400 },
      );
    }
    patch.brackets = rows;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    return NextResponse.json({ settings: await saveFinanceSettings(patch) });
  } catch (e) {
    console.error('[/api/finances/settings] save failed', e);
    return NextResponse.json({ error: 'Could not save those settings.' }, { status: 500 });
  }
}
