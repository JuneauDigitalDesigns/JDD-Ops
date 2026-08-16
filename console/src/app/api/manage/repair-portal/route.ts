import { NextResponse } from 'next/server';
import type { PortalPlan, PortalSite, PortalSiteStatus } from '@jdd/schema';
import { accountStoreConfigured, patchSite } from '@/lib/accountStore';
import { appendAudit } from '@/lib/audit';

/**
 * Set individual fields on a client's portal site record.
 *
 * The gap this closes: when a live site is missing an id the portal needs — a
 * `vercelProjectId` that was never recorded, a Stripe subscription that was never linked —
 * the client sees a tab stuck on "we're finishing your setup" and nothing in the product
 * can fix it. `link-portal` can't: it rebuilds entries from disk via
 * `buildPortalSiteEntries`, which by design cannot express `vercelProjectId` and never
 * touches the Stripe fields. Until now the only cure was a CLI script, which is the wrong
 * place for the thing you reach for when a client is broken.
 *
 * Cancellation timestamps are deliberately NOT editable here. `cancelRequestedAt` /
 * `cancelEffectiveAt` are the written notice the MSA relies on; changing them by hand is
 * altering a legal record, not repairing a config.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[A-Za-z0-9_-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PLANS: PortalPlan[] = ['starter', 'growth', 'enterprise'];
const STATUSES: PortalSiteStatus[] = ['pending-onboarding', 'building', 'live'];

/** Fields this route will write, and nothing else. */
const NULLABLE_FIELDS = [
  'airtableBaseId',
  'vercelProjectId',
  'canonical',
  'stripeSubscriptionId',
  'stripeCustomerId',
] as const;

type NullableField = (typeof NULLABLE_FIELDS)[number];

interface Body {
  slug?: string;
  siteSlug?: string;
  email?: string;
  /**
   * Only the fields being changed. A key that is absent is left alone; a key set to `null`
   * is explicitly cleared. That distinction is carried all the way from this JSON body to
   * `upsertSite`, because collapsing it is what caused a good Airtable base id to be
   * overwritten with null in the first place.
   */
  fields?: Partial<Record<NullableField, string | null>> & {
    plan?: PortalPlan;
    status?: PortalSiteStatus;
  };
  dryRun?: boolean;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  const siteSlug = (body.siteSlug ?? '').trim();
  const email = (body.email ?? '').trim();
  const dryRun = body.dryRun !== false; // Default ON: this writes to live KV.

  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: 'Invalid client slug.' }, { status: 400 });
  if (!SLUG_RE.test(siteSlug)) return NextResponse.json({ error: 'Invalid site slug.' }, { status: 400 });
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid account email is required.' }, { status: 400 });
  }
  if (!accountStoreConfigured()) {
    return NextResponse.json(
      { error: 'KV not configured — set KV_REST_API_URL / KV_REST_API_TOKEN.' },
      { status: 500 },
    );
  }

  // Build the patch by copying only keys the caller actually sent, so an absent field
  // stays absent rather than becoming `undefined` in a way that looks deliberate.
  const raw = body.fields ?? {};
  // Built as a loose bag and narrowed on the way out: every key written here is one of
  // NULLABLE_FIELDS / plan / status, all of which exist on PortalSite.
  const patch: Record<string, string | null> = {};

  for (const field of NULLABLE_FIELDS) {
    if (!(field in raw)) continue;
    const value = raw[field];
    if (value === null) {
      patch[field] = null;
      continue;
    }
    if (typeof value !== 'string') {
      return NextResponse.json({ error: `${field} must be a string or null.` }, { status: 400 });
    }
    const trimmed = value.trim();
    // An empty box is ambiguous — it could mean "clear this" or "I didn't fill it in".
    // Refuse rather than guess; the UI has an explicit Clear control for the first.
    if (!trimmed) {
      return NextResponse.json(
        { error: `${field} is empty — use Clear to set it to none, or leave it unchanged.` },
        { status: 400 },
      );
    }
    patch[field] = trimmed;
  }

  if ('plan' in raw) {
    if (!raw.plan || !PLANS.includes(raw.plan)) {
      return NextResponse.json({ error: `plan must be one of ${PLANS.join(', ')}.` }, { status: 400 });
    }
    patch.plan = raw.plan;
  }
  if ('status' in raw) {
    if (!raw.status || !STATUSES.includes(raw.status)) {
      return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}.` }, { status: 400 });
    }
    patch.status = raw.status;
  }

  const changedKeys = Object.keys(patch);
  if (changedKeys.length === 0) {
    return NextResponse.json({ error: 'No fields to change.' }, { status: 400 });
  }

  try {
    const result = await patchSite(email, siteSlug, patch as Partial<PortalSite>, { dryRun });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    // Which fields moved, for the UI's diff — values included in the RESPONSE (the
    // operator is looking at them anyway) but never in the audit file.
    const before = result.before as unknown as Record<string, unknown>;
    const after = result.after as unknown as Record<string, unknown>;
    const changes = changedKeys.map((key) => ({
      field: key,
      from: before[key] ?? null,
      to: after[key] ?? null,
    }));
    const effective = changes.filter((c) => c.from !== c.to);

    if (result.written && effective.length > 0) {
      appendAudit({
        slug,
        siteSlug,
        action: 'portal.repair',
        ok: true,
        summary: `Repaired ${effective.length} field${effective.length === 1 ? '' : 's'} on ${siteSlug}`,
        // Key names only. `stripeSubscriptionId` in a plaintext file on disk would be a
        // secret leak, and the same rule applies to every other value here.
        detail: { email, fields: effective.map((c) => c.field) },
      });
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      written: result.written,
      changes,
      effective: effective.map((c) => c.field),
      after: result.after,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Repair failed.';
    if (!dryRun) {
      appendAudit({ slug, siteSlug, action: 'portal.repair', ok: false, summary: message });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
