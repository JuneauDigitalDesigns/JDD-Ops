import { NextResponse } from 'next/server';
import { loadManageTarget } from '@/lib/manageSites';
import { loadRegister, loadStore, type A2pIntakeRecord } from '@/lib/a2pChain';
import { loadA2pEnv } from '@/lib/opsSecrets';
import { siteNumbers } from '@/lib/a2pServer';
import { appendAudit } from '@/lib/audit';

/**
 * The Messaging & A2P section's read, and the intake correction write.
 *
 *   GET ?slug=   the registration record, the step table with what is legal now, the client's
 *                intake record, and what the client still owes us.
 *   PUT ?slug=   save the operator's corrections to `jdd:a2p-intake:{slug}`.
 *
 * Nothing sensitive can come back from the GET: the registration record holds SIDs, statuses
 * and evaluations by schema (`REGISTRATION_KEYS`), and the intake holds no EIN and no rep.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fields the operator needs before identity steps can run — named so the client can be chased. */
function intakeMissing(intake: A2pIntakeRecord | null): string[] {
  if (!intake) return ['the whole business-registration step'];
  const missing: string[] = [];
  if (!intake.legalBusinessName?.trim()) missing.push('legal business name (as registered with the IRS)');
  if (!intake.businessType?.trim()) missing.push('business type');
  if (!intake.websiteUrl?.trim()) missing.push('website');
  for (const [key, label] of [['street', 'street'], ['city', 'city'], ['region', 'state'], ['postalCode', 'ZIP'], ['country', 'country']] as const) {
    if (!intake.address?.[key]?.trim()) missing.push(`address ${label}`);
  }
  return missing;
}

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug');
  const target = await loadManageTarget(slug, null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });
  const { ctx } = target;

  try {
    const [register, store] = await Promise.all([loadRegister(), loadStore()]);
    const [record, intake] = await Promise.all([store.readRegistration({ slug: ctx.slug }), store.readIntake({ slug: ctx.slug })]);
    const numbers = siteNumbers(ctx);
    const env = loadA2pEnv();
    return NextResponse.json({
      plan: ctx.plan,
      registers: register.REGISTERING_PLANS.includes(ctx.plan),
      record,
      steps: register.STEPS.map(({ id, runbook, label, write, path }) => ({ id, runbook, label, write, path })),
      availability: register.availability(record, {
        plan: ctx.plan,
        primaryProfileSid: (env.TWILIO_PRIMARY_PROFILE_SID ?? '').trim(),
        siteSlugs: Object.keys(numbers),
      }),
      portalStatus: register.portalStatusFor(record),
      intake,
      intakeMissing: intakeMissing(intake),
      numbers,
      masterServiceSid: (env.TWILIO_MESSAGING_SERVICE_SID ?? '').trim() || null,
      brandName: ctx.brandName,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not read the A2P record.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug');
  const target = await loadManageTarget(slug, null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  let body: { intake?: Partial<A2pIntakeRecord> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const patch = body.intake ?? {};
  try {
    const store = await loadStore();
    // writeIntake refuses unknown keys (an `ein` key included) and tax-ID-shaped values.
    const intake = await store.writeIntake({ slug: target.ctx.slug, patch });
    appendAudit({
      slug: target.ctx.slug,
      action: 'a2p.intake',
      ok: true,
      summary: 'Corrected A2P intake fields.',
      detail: { keys: Object.keys(patch) },
    });
    return NextResponse.json({ ok: true, intake });
  } catch (err) {
    // The store's refusals name paths and keys, never values.
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not save.' }, { status: 400 });
  }
}
