import { NextResponse } from 'next/server';
import { getClientContext, siteDirFor } from '@/lib/clients';
import { loadIntake } from '@/lib/intake';
import { applyEnvUpdates } from '@/lib/envFile';
import { loadClientEnv, envLinesToObject } from '@/lib/clientEnv';
import { loadRetellApiKey } from '@/lib/opsSecrets';
import { appendAudit } from '@/lib/audit';
import { callPortalOps } from '@/lib/portalPlanChange';
import {
  brandContact,
  mirrorPlanToPortal,
  planEditError,
  pushEnvAndRedeploy,
  schemaPathFor,
  writePlanToSchema,
} from '@/lib/planChange';

/**
 * Upgrade a client starter → growth.
 *
 * This flips the flag and writes every growth env key we can know without calling a paid
 * API. It deliberately does NOT provision anything: the Retell agent, the Twilio number,
 * and the Airtable base are real purchases, and onboard.js owns creating them.
 *
 * That leaves the client in a genuinely broken intermediate state — LEAD_DELIVERY_MODE is
 * now `callback`, but /api/contact has no RETELL_AGENT_ID or TWILIO_NUMBER to call with, so
 * lead capture on the live site fails until onboarding is re-run. That is the honest
 * consequence of the operator's request, so the response says so loudly and Overview
 * renders a standing banner until the ids appear. syncEnvToVercel raises the same warning
 * from its side; both are surfaced rather than one being swallowed.
 *
 * Billing moves in the same action, through the agency's /api/ops/plan-sync (step 3b).
 *
 * Downgrades go the other way through ./downgrade/*. They are requested first (the client
 * accepts the Starter terms and Stripe moves them at the end of their paid period), and the
 * env/site.ts half runs once that has happened. Nothing is destroyed either way.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

type Body = { slug?: string; targetPlan?: string };

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
  if (body.targetPlan !== 'growth') {
    return NextResponse.json(
      { error: 'This route only upgrades starter → growth. Use ./downgrade to go the other way.' },
      { status: 400 },
    );
  }

  const ctx = await getClientContext(slug);
  if (!ctx) return NextResponse.json({ error: `No client at clients/${slug}.` }, { status: 404 });

  const blocked = planEditError(ctx, 'growth');
  if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
  if (ctx.plan !== 'starter') {
    return NextResponse.json(
      { error: `Only a starter client can be upgraded here (${slug} is ${ctx.plan}).` },
      { status: 400 },
    );
  }

  // ── 1. clients/{slug}/site.ts ─────────────────────────────────────────────
  const { repoRoot, file, exists } = schemaPathFor(slug);
  if (!exists) {
    return NextResponse.json({ error: `No site.ts at clients/${slug}.` }, { status: 404 });
  }
  const intake = await loadIntake(file);
  if (!intake?.sites?.length) {
    return NextResponse.json({ error: 'Could not parse site.ts.' }, { status: 422 });
  }

  const shape = writePlanToSchema(repoRoot, file, slug, intake, 'growth');
  if (!shape) {
    return NextResponse.json({ error: 'Unrecognized site.ts shape.' }, { status: 422 });
  }

  // ── 2. clients/{slug}/.env.local ──────────────────────────────────────────
  // Derived from onboard.js's OWN template via lib/client-env.js, not re-written here.
  //
  // This route used to hand-roll the growth keys, and the copy had drifted: it wrote
  // CLIENT_FORWARD_RING_SECONDS=25 where onboard.js writes 15. Above ~20s the owner's carrier
  // voicemail answers the forward leg, Twilio scores the call as answered, the no-answer
  // branch never fires, and the caller lands in voicemail instead of the receptionist — so
  // every client upgraded through this route inherited a silently broken ring window.
  //
  // Only keys that need no paid API are applied. RETELL_AGENT_ID / TWILIO_NUMBER /
  // AIRTABLE_BASE_ID are real purchases that onboard.js owns, so they stay absent — that
  // intermediate state is the whole point of the banner below.
  const site = ctx.sites[0];
  const dir = siteDirFor(slug, 1, 0);
  const brand = brandContact(intake.sites[0]);

  const { buildClientEnvLines } = await loadClientEnv();
  const retellKey = loadRetellApiKey();
  const template = envLinesToObject(
    buildClientEnvLines({
      siteSlug: site.slug,
      plan: 'growth',
      content: { brand: { ...intake.sites[0].brand, phone: brand.phone ?? '' } },
      webOnly: false,
      // The existing file wins for anything already provisioned, exactly as a re-run would.
      prev: site.env as Record<string, string>,
      env: { RETELL_API_KEY: retellKey ?? '' },
    }).lines,
  );

  // Provisioned-only keys are onboard.js's to create; an empty value here would overwrite a
  // real id with a blank on a re-upgrade.
  const PROVISIONED = new Set(['RETELL_AGENT_ID', 'RETELL_LLM_ID', 'TWILIO_NUMBER', 'AIRTABLE_BASE_ID', 'RETELL_POST_CALL_WEBHOOK_URL']);
  const updates: Record<string, string> = {};
  for (const [k, v] of Object.entries(template)) {
    if (PROVISIONED.has(k) || v === '') continue;
    updates[k] = v;
  }

  const written = applyEnvUpdates(dir, updates);

  // ── 3. The portal account record ──────────────────────────────────────────
  const kv = await mirrorPlanToPortal(site.slug, site.env.CLERK_USER_ID, 'growth');

  // ── 3b. Billing, in the same action ───────────────────────────────────────
  // The agency's webhook takes a site's plan from the price Stripe bills, so a KV-only upgrade
  // would be put back to starter by the next subscription event (a renewal, a card update).
  // Syncing here moves Stripe to Growth now, prorated, through the agency; the console still
  // never touches Stripe. A declined card is reported, not hidden.
  let billing: { ok: boolean; changed?: boolean; error?: string } | null = null;
  if (kv.ok && kv.email) {
    const out = await callPortalOps<{ ok?: boolean; changed?: boolean }>('/api/ops/plan-sync', {
      method: 'POST',
      body: { email: kv.email, slug: site.slug, plan: 'growth' },
    });
    billing = out.ok ? { ok: true, changed: Boolean(out.body.changed) } : { ok: false, error: out.error };
    appendAudit({
      slug,
      siteSlug: site.slug,
      action: 'plan.billing.sync',
      ok: billing.ok,
      summary: billing.ok
        ? billing.changed
          ? 'Billing synced to growth in Stripe'
          : 'Billing already on growth — no change'
        : `Billing sync to growth failed: ${billing.error}`,
      detail: { plan: 'growth', changed: Boolean(billing.changed) },
    });
  }

  // ── 4. Vercel ─────────────────────────────────────────────────────────────
  const envPush = await pushEnvAndRedeploy({ siteSlug: site.slug, dir, brandName: ctx.brandName });

  const missing = ['RETELL_AGENT_ID', 'TWILIO_NUMBER', 'AIRTABLE_BASE_ID'].filter(
    (k) => !site.env[k],
  );

  appendAudit({
    slug,
    siteSlug: site.slug,
    action: 'plan.upgrade',
    ok: true,
    summary: `Plan starter → growth for ${ctx.brandName}${missing.length ? ` — not provisioned: ${missing.join(', ')}` : ''}`,
    // Key names only, never values — this file is plaintext on disk.
    detail: { from: 'starter', to: 'growth', shape, wrote: [...written.updated, ...written.added], missing },
  });

  return NextResponse.json({
    ok: true,
    plan: 'growth',
    written,
    kv,
    billing,
    ...envPush,
    needsOnboarding: missing.length > 0,
    missing,
    note: billing && !billing.ok
      ? `Plan set to growth, but billing did not move: ${billing.error} Stripe is still billing starter; sync billing from the Billing panel once that is fixed.`
      : missing.length
      ? `Nothing was provisioned. ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} still unset, so the live site's /api/contact cannot place a callback — lead capture is broken until you re-run onboarding for this client (npm run onboard -- --schema clients/${slug}/site.ts).`
      : 'Plan flipped to growth; the voice infrastructure was already provisioned.',
  });
}
