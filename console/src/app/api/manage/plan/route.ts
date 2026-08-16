import { NextResponse } from 'next/server';
import { getClientContext, siteDirFor } from '@/lib/clients';
import { loadIntake } from '@/lib/intake';
import { applyEnvUpdates } from '@/lib/envFile';
import { loadRetellApiKey } from '@/lib/opsSecrets';
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
 * Downgrades go the other way through ./downgrade/*, which needs a preview and a typed
 * confirmation because it destroys resources.
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
  // Mirrors onboard.js's growth template (writeClientEnvLocal) for the keys that don't
  // require provisioning. RETELL_AGENT_ID / TWILIO_NUMBER / AIRTABLE_BASE_ID are the three
  // that do, and they stay absent — the whole point of the banner.
  const site = ctx.sites[0];
  const dir = siteDirFor(slug, 1, 0);
  const brand = brandContact(intake.sites[0]);

  const updates: Record<string, string> = { LEAD_DELIVERY_MODE: 'callback' };
  const retellKey = loadRetellApiKey();
  if (retellKey) updates.RETELL_API_KEY = retellKey;
  if (!site.env.RETELL_SIP_DOMAIN) updates.RETELL_SIP_DOMAIN = 'sip.retellai.com';
  if (brand.phone && !site.env.CLIENT_FORWARD_PHONE) updates.CLIENT_FORWARD_PHONE = brand.phone;
  if (!site.env.CLIENT_FORWARD_RING_SECONDS) updates.CLIENT_FORWARD_RING_SECONDS = '25';

  const written = applyEnvUpdates(dir, updates);

  // ── 3. The portal account record ──────────────────────────────────────────
  const kv = await mirrorPlanToPortal(site.slug, site.env.CLERK_USER_ID, 'growth');

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
    ...envPush,
    needsOnboarding: missing.length > 0,
    missing,
    note: missing.length
      ? `Nothing was provisioned. ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} still unset, so the live site's /api/contact cannot place a callback — lead capture is broken until you re-run onboarding for this client (npm run onboard -- --schema clients/${slug}/site.ts).`
      : 'Plan flipped to growth; the voice infrastructure was already provisioned.',
  });
}
