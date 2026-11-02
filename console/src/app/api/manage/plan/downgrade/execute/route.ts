import { NextResponse } from 'next/server';
import { getClientContext, siteDirFor } from '@/lib/clients';
import { loadIntake } from '@/lib/intake';
import { applyEnvUpdates } from '@/lib/envFile';
import { type StepResult } from '@/lib/teardownOps';
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

  // ── 1. Nothing is destroyed ───────────────────────────────────────────────
  // There used to be three calls here: releaseTwilioNumber, deleteRetellAgent and
  // deleteRetellLlm. They were right before the 2026-10-12 reprice, when Starter had no
  // receptionist. Since then Starter runs the same voice stack as Growth, so a downgrade
  // that released the number and deleted the agent was taking away service the client still
  // pays for — and the number is unrecoverable, so it could not be undone by downgrading
  // back. The three differences between the tiers are CRM access, web-form behaviour and the
  // minutes allowance, and none of them is a vendor resource.
  const steps: StepResult[] = [];

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
  // One key. `LEAD_DELIVERY_MODE` stays `portal`, because email is not a lead delivery mode
  // on any tier — every client's web-form leads land in their portal inbox. What changes is
  // whether the agent calls the submitter back first: Growth does, Starter does not.
  //
  // Nothing else is touched. RETELL_AGENT_ID, RETELL_LLM_ID and TWILIO_NUMBER used to be
  // blanked here to match the resources this route deleted; they now describe a voice stack
  // the client keeps, and blanking them would leave /api/voice unable to reach the agent
  // while the agent itself sat alive and billing. AIRTABLE_BASE_ID was already deliberately
  // absent for the same reason.
  const dir = siteDirFor(slug, 1, 0);

  const updates: Record<string, string> = {
    LEAD_CALLBACK: 'off',
  };

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
