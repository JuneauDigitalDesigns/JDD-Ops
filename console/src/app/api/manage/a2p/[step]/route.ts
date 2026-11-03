import { NextResponse } from 'next/server';
import { loadManageTarget } from '@/lib/manageSites';
import { loadIdentity, loadRegister, loadStore } from '@/lib/a2pChain';
import { loadA2pEnv } from '@/lib/opsSecrets';
import { siteNumbers, syncPortalStatus } from '@/lib/a2pServer';
import { appendAudit } from '@/lib/audit';

/**
 * One A2P registration step per call — `POST /api/manage/a2p/{step}?slug=`.
 *
 * ── The rules this file exists to keep (plan §6) ─────────────────────────────────────────────
 *   - **The slug is the only thing in the URL.** Everything the operator typed — the EIN, the
 *     rep's email and mobile — is in the POST body. A query string is what request logs keep.
 *   - **The request body is never logged**, in whole or in part, and no error path
 *     interpolates it. Vendor errors are scrubbed at construction (`A2pVendorError`); anything
 *     else is scrubbed again here against the submitted values before it is returned.
 *   - **The response never echoes input.** It returns the record (SIDs and statuses, by schema)
 *     and a one-line summary built from SIDs.
 *   - **Audit gets the step name and the summary, never a field value**, and the entry is
 *     tax-ID-checked before it is written — `audit.ndjson` is the one log written to disk and kept.
 *   - **Every write needs `confirm: true`**, which only the section's confirm dialog sends; the
 *     four steps that FILE something with Twilio — and so start a review clock or a fee — also
 *     need the client slug typed back (`confirmSlug`). Server-side, so a stray script cannot skip
 *     the dialog. Readiness and step order are then enforced again inside `runStep`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Steps that submit for review or incur a fee. */
const FILING_STEPS = new Set(['profile.submit', 'trust.submit', 'brand.register', 'campaign.create']);

type Body = { input?: Record<string, unknown>; confirm?: boolean; confirmSlug?: string };

export async function POST(req: Request, { params }: { params: { step: string } }) {
  const slug = new URL(req.url).searchParams.get('slug');
  const target = await loadManageTarget(slug, null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });
  const { ctx } = target;
  const step = params.step;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const input: Record<string, unknown> = { ...(body.input ?? {}) };
  // Every string the operator typed, for scrubbing a non-vendor error. Never logged.
  const submitted = Object.values(input).filter((v): v is string => typeof v === 'string' && v.trim().length >= 4);

  const [register, store, identity] = await Promise.all([loadRegister(), loadStore(), loadIdentity()]);
  const def = register.STEPS.find((s) => s.id === step);
  if (!def) return NextResponse.json({ error: `Unknown step "${step}".` }, { status: 404 });

  if (def.write) {
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Every A2P write must be confirmed in the dialog.' }, { status: 400 });
    }
    if (FILING_STEPS.has(step) && body.confirmSlug !== ctx.slug) {
      return NextResponse.json({ error: `Type the client slug (${ctx.slug}) to confirm this filing.` }, { status: 400 });
    }
  }

  // The number to attach comes from the site's own .env.local, never from the browser.
  const numbers = siteNumbers(ctx);
  if (step === 'number.attach') {
    const siteSlug = String(input.siteSlug ?? '');
    if (!numbers[siteSlug]) return NextResponse.json({ error: `${siteSlug || 'That site'} has no TWILIO_NUMBER.` }, { status: 400 });
    input.e164 = numbers[siteSlug];
  }

  let before: Awaited<ReturnType<typeof store.readRegistration>> = null;
  try {
    before = await store.readRegistration({ slug: ctx.slug });
    const statusBefore = register.portalStatusFor(before);
    const result = await register.runStep({
      step,
      slug: ctx.slug,
      plan: ctx.plan,
      record: before,
      input,
      siteSlugs: Object.keys(numbers),
      env: loadA2pEnv(),
      // Each SID is written the instant the vendor returns it — the step calls this per create.
      persist: (patch, current) => store.writeRegistration({ slug: ctx.slug, patch, current }),
    });

    const statusAfter = register.portalStatusFor(result.record);
    const portal = statusAfter !== statusBefore ? await syncPortalStatus(ctx, statusAfter) : [];

    audit(store, { slug: ctx.slug, ok: true, summary: `A2P ${def.label}: ${result.summary}`, step });
    return NextResponse.json({ ok: true, summary: result.summary, record: result.record, portalStatus: statusAfter, portal });
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Step failed.';
    const message = identity.findTaxIdPaths(raw).length ? 'Step failed (message withheld: it contained a tax-ID-shaped value).' : scrub(raw, submitted);
    const refused = err instanceof register.A2pStepRefused;
    audit(store, { slug: ctx.slug, ok: false, summary: `A2P ${def.label} ${refused ? 'refused' : 'failed'}: ${message}`, step });
    // A partial step may have saved SIDs before failing; hand back what the store now holds.
    const record = await store.readRegistration({ slug: ctx.slug }).catch(() => before);
    return NextResponse.json({ ok: false, error: message, refused, record }, { status: refused ? 409 : 502 });
  }
}

/** Remove every submitted value from a message. Belt and braces over A2pVendorError's own scrub. */
function scrub(message: string, submitted: string[]): string {
  let out = message;
  for (const value of submitted) out = out.split(value.trim()).join('[redacted]');
  return out;
}

function audit(
  store: Awaited<ReturnType<typeof loadStore>>,
  { slug, ok, summary, step }: { slug: string; ok: boolean; summary: string; step: string },
) {
  const entry = { slug, action: 'a2p.step' as const, ok, summary, detail: { step } };
  try {
    store.assertNoTaxId(entry, 'a2p audit');
  } catch {
    appendAudit({ slug, action: 'a2p.step', ok, summary: `A2P ${step}: summary withheld (tax-ID-shaped).`, detail: { step } });
    return;
  }
  appendAudit(entry);
}
