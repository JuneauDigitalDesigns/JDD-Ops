import { NextResponse } from 'next/server';
import { getClientContext, siteDirFor } from '@/lib/clients';
import { loadIntake } from '@/lib/intake';
import { applyEnvUpdates } from '@/lib/envFile';
import { loadRetellApiKey, loadTeardownCredentials } from '@/lib/opsSecrets';
import { loadTeardownOps, type StepResult } from '@/lib/teardownOps';
import { buildPlanDowngradePreview, PlanDowngradeError } from '@/lib/planDowngrade';
import { appendAudit } from '@/lib/audit';
import {
  brandContact,
  mirrorPlanToPortal,
  planEditError,
  pushEnvAndRedeploy,
  schemaPathFor,
  writePlanToSchema,
} from '@/lib/planChange';

/**
 * Downgrade a client growth → starter, destroying the voice tier.
 *
 * The narrow sibling of api/manage/teardown: that route destroys the whole client, this one
 * keeps the site, the repo, the Vercel project, the domain, and the content, and removes
 * only what the growth tier bought — the Twilio number and the Retell agent + per-client
 * LLM. **The Airtable base is never touched**; it holds the client's call history, which
 * outlives their voice plan.
 *
 * Guards, in the order they run and for the reasons teardown/route.ts documents:
 *   • typed slug confirmation, so this can't fire from a stray fetch;
 *   • the preview is rebuilt SERVER-SIDE and its hash compared — a client-supplied plan is
 *     never trusted, and a resource that changed since the operator looked means the thing
 *     they approved is not the thing about to happen.
 *
 * Unlike teardown this is plain JSON rather than a streamed NDJSON run with an archive
 * record and a lock. Three bounded calls with no ordering hazard don't need that machinery,
 * and the resources removed here are individually re-creatable by re-running onboarding
 * (a new number, a new agent) — the archive exists for the case where site.ts itself is
 * deleted, which this route never does.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

type Body = { slug?: string; previewHash?: string; confirmSlug?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Invalid client slug.' }, { status: 400 });
  }
  if ((body.confirmSlug ?? '').trim() !== slug) {
    return NextResponse.json({ error: 'Confirmation slug does not match.' }, { status: 400 });
  }

  // Rebuilt, never taken from the request — the hash is only meaningful against a fresh probe.
  let preview;
  try {
    preview = await buildPlanDowngradePreview(slug);
  } catch (err) {
    const status = err instanceof PlanDowngradeError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not verify this client.' },
      { status },
    );
  }
  if (preview.previewHash !== (body.previewHash ?? '')) {
    return NextResponse.json(
      { error: 'The preview has changed since it was loaded. Refresh it and try again.' },
      { status: 409 },
    );
  }

  const ctx = await getClientContext(slug);
  if (!ctx) return NextResponse.json({ error: `No client at clients/${slug}.` }, { status: 404 });
  const blocked = planEditError(ctx, 'starter');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });

  const site = ctx.sites[0];

  // ── 1. Destroy the voice tier ─────────────────────────────────────────────
  const ops = await loadTeardownOps();
  const retellKey = loadRetellApiKey();
  const { twilioAccountSid, twilioAuthToken } = loadTeardownCredentials();

  const steps: StepResult[] = [
    await ops.releaseTwilioNumber({
      accountSid: twilioAccountSid ?? undefined,
      authToken: twilioAuthToken ?? undefined,
      phoneNumber: preview.twilio.number ?? undefined,
    }),
    await ops.deleteRetellAgent({
      apiKey: retellKey ?? undefined,
      agentId: preview.retell.agentId ?? undefined,
    }),
    await ops.deleteRetellLlm({ apiKey: retellKey ?? undefined, llmId: preview.retell.llmId }),
  ];
  // Note the absence: no ops.deleteAirtableBase. That is the point of this route.

  // ── 2. clients/{slug}/site.ts ─────────────────────────────────────────────
  const { repoRoot, file, exists } = schemaPathFor(slug);
  if (!exists) {
    return NextResponse.json({ error: `No site.ts at clients/${slug}.` }, { status: 404 });
  }
  const intake = await loadIntake(file);
  if (!intake?.sites?.length) {
    return NextResponse.json({ error: 'Could not parse site.ts.' }, { status: 422 });
  }
  const shape = writePlanToSchema(repoRoot, file, slug, intake, 'starter');
  if (!shape) {
    return NextResponse.json({ error: 'Unrecognized site.ts shape.' }, { status: 422 });
  }

  // ── 3. clients/{slug}/.env.local ──────────────────────────────────────────
  // A growth .env.local has none of the starter lead-email keys, so flipping only
  // LEAD_DELIVERY_MODE would leave /api/contact returning 502 on every lead. Fill in what
  // onboard.js's starter template writes; RESEND_API_KEY can't be seeded (it isn't in
  // jdd-ops/.env — onboard.js only preserves it) and is reported as a preview warning.
  const dir = siteDirFor(slug, 1, 0);
  const brand = brandContact(intake.sites[0]);

  const updates: Record<string, string> = {
    LEAD_DELIVERY_MODE: 'email',
    LEAD_BRAND_NAME: brand.name ?? ctx.brandName,
    RESEND_FROM_EMAIL: site.env.RESEND_FROM_EMAIL || 'leads@juneaudigitaldesigns.com',
    // Cleared, not deleted — see the caveat on the response below.
    RETELL_AGENT_ID: '',
    RETELL_LLM_ID: '',
    TWILIO_NUMBER: '',
  };
  if (preview.leadEmail.to) updates.LEAD_TO_EMAIL = preview.leadEmail.to;
  // AIRTABLE_BASE_ID is deliberately absent from this map — the base survives, so the id
  // that points at it must too.

  const written = applyEnvUpdates(dir, updates);

  // ── 4. The portal account record ──────────────────────────────────────────
  // Only `plan` is passed, so upsertSite's merge leaves airtableBaseId and the rest alone.
  const kv = await mirrorPlanToPortal(site.slug, site.env.CLERK_USER_ID, 'starter');

  // ── 5. Vercel ─────────────────────────────────────────────────────────────
  const envPush = await pushEnvAndRedeploy({ siteSlug: site.slug, dir, brandName: ctx.brandName });

  const failed = steps.filter((s) => s.outcome === 'failed');
  appendAudit({
    slug,
    siteSlug: site.slug,
    action: 'plan.downgrade',
    ok: failed.length === 0,
    summary: `Plan growth → starter for ${ctx.brandName} — ${steps.length - failed.length}/${steps.length} resources released${failed.length ? `, ${failed.length} failed` : ''}; Airtable base kept`,
    detail: {
      from: 'growth',
      to: 'starter',
      shape,
      steps: steps.map((s) => ({ resource: s.resource, outcome: s.outcome, message: s.message })),
      wrote: [...written.updated, ...written.added],
      airtableKept: preview.airtable.baseId ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    plan: 'starter',
    steps,
    written,
    kv,
    ...envPush,
    airtableKept: preview.airtable,
    // syncEnvToVercel skips empty values and vercel-sync.js exposes no delete, so the
    // cleared keys stay on the Vercel project. They're inert — /api/contact branches on
    // LEAD_DELIVERY_MODE, which did get pushed — but claiming a clean wipe would be a lie.
    staleOnVercel: ['RETELL_AGENT_ID', 'RETELL_LLM_ID', 'TWILIO_NUMBER'].filter((k) => site.env[k]),
    note: failed.length
      ? `${failed.length} resource${failed.length === 1 ? '' : 's'} could not be released — the plan still changed to starter. Check the steps and clean up in the provider console.`
      : 'Downgraded to starter. The Airtable base and its call history were kept.',
  });
}
