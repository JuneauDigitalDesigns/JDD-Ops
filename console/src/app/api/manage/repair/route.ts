import { NextResponse } from 'next/server';
import { getClientContext } from '@/lib/clients';
import { loadRepairOps } from '@/lib/repairOps';
import { loadVercelSync } from '@/lib/vercelSync';
import {
  loadVercelCredentials,
  loadRetellApiKey,
  loadMakeApiKey,
  loadTeardownCredentials,
} from '@/lib/opsSecrets';
import { resolveLiveUrl } from '@/lib/manageSites';
import { appendAudit } from '@/lib/audit';
import { recordUndo, type UndoKind } from '@/lib/undo';
import { applyEnvUpdates } from '@/lib/envFile';
import { siteDirFor } from '@/lib/clients';
import { accountStoreConfigured, getAccount } from '@/lib/accountStore';
import { clientRecordsConfigured, getClientRecordBySlug } from '@/lib/clientRecord';
import { toE164 } from '@jdd/schema';
import type { ClientContext, SiteInfo } from '@/lib/types';

/** Same disk-then-record resolution reconcile uses; see resolvePortalAccount there. */
async function resolveAccountFor(ctx: ClientContext) {
  if (!accountStoreConfigured()) return null;
  const fromDisk = ctx.sites[0]?.env.PORTAL_ACCOUNT_EMAIL ?? null;
  if (fromDisk) {
    const account = await getAccount(fromDisk).catch(() => null);
    if (account) return account;
  }
  if (!clientRecordsConfigured()) return null;
  const record = await getClientRecordBySlug(ctx.slug).catch(() => null);
  return record?.email ? getAccount(record.email).catch(() => null) : null;
}

/**
 * Apply one repair named by a finding.
 *
 * ONE route rather than four (twilio/, retell/, make/, airtable/), because the vendor call
 * is the only part that differs. Everything around it — resolving the site, reading the
 * previous value, recording an undo, writing an audit line, reporting honestly — is
 * identical, and four copies of that is four places for the undo to be forgotten in.
 *
 * The contract every branch keeps:
 *   - never write without having read `before` first (repair-ops enforces this too)
 *   - record the undo BEFORE returning success, so the UI can only offer an undo that exists
 *   - one audit line per attempt, success or failure, values never included
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAKE_ZONE = 'https://us2.make.com/api/v2';

/** The console has no auth; every write path is localhost-only, as env/reveal is. */
function isLoopback(req: Request): boolean {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

export type RepairAction =
  | 'twilio.voiceUrl'
  | 'retell.webhook'
  | 'make.activate'
  | 'profile.forwardPhone';

interface Body {
  slug?: string;
  siteSlug?: string;
  action?: RepairAction;
  /** Make only: which scenario to start. Comes from the finding. */
  scenarioId?: number | string;
}

export async function POST(req: Request) {
  if (!isLoopback(req)) {
    return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const { slug, siteSlug, action } = body;
  if (!slug || !siteSlug || !action) {
    return NextResponse.json({ error: 'slug, siteSlug and action are required.' }, { status: 400 });
  }

  const ctx = await getClientContext(slug);
  if (!ctx) return NextResponse.json({ error: `No such client: ${slug}` }, { status: 404 });

  const site = ctx.sites.find((s) => s.slug === siteSlug);
  if (!site) {
    return NextResponse.json(
      { error: `Client ${slug} has no site "${siteSlug}" (has: ${ctx.sites.map((s) => s.slug).join(', ')})` },
      { status: 404 },
    );
  }

  const ops = await loadRepairOps();

  try {
    switch (action) {
      case 'twilio.voiceUrl':
        return await repairVoiceUrl(ops, ctx.slug, site);
      case 'retell.webhook':
        return await repairRetellWebhook(ops, ctx.slug, site);
      case 'make.activate':
        return await activateMakeScenario(ops, ctx.slug, site, body.scenarioId);
      case 'profile.forwardPhone':
        return await adoptPortalForwardPhone(ctx, site);
      default:
        return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
    }
  } catch (err) {
    console.error('[repair] failed', slug, siteSlug, action, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** Shared tail: record the undo, write the audit line, answer the UI. */
function settle({
  slug,
  siteSlug,
  kind,
  action,
  summary,
  result,
}: {
  slug: string;
  siteSlug: string;
  kind: UndoKind;
  action: Parameters<typeof appendAudit>[0]['action'];
  summary: string;
  result: { ok: boolean; before?: unknown; after?: unknown; reason: string | null; noop?: boolean };
}) {
  if (!result.ok) {
    appendAudit({ slug, siteSlug, action, ok: false, summary: `${summary} — failed`, detail: { reason: result.reason } });
    return NextResponse.json({ error: result.reason ?? 'Repair failed.' }, { status: 502 });
  }

  // A no-op gets an audit line but no undo: there is nothing to put back, and offering an
  // undo that would rewrite a value to itself is noise at best and misleading at worst.
  if (result.noop) {
    appendAudit({ slug, siteSlug, action, ok: true, summary: `${summary} — already correct` });
    return NextResponse.json({ ok: true, changed: false, message: 'Already correct.' });
  }

  const undoId = recordUndo({
    slug,
    siteSlug,
    kind,
    summary,
    before: result.before ?? null,
    after: result.after ?? null,
  });

  appendAudit({ slug, siteSlug, action, ok: true, summary, detail: { undoId } });
  return NextResponse.json({ ok: true, changed: true, undoId });
}

/**
 * Point the number back at the host Vercel actually serves.
 *
 * The target is resolved from Vercel, never derived from the slug — deriving it is the bug
 * that pointed every underscore-containing client's calls at a hostname that does not
 * exist (see vercelAppHost). If Vercel can't answer, we refuse rather than guess: writing a
 * guessed URL over a possibly-correct one is strictly worse than leaving the drift visible.
 */
async function repairVoiceUrl(ops: Awaited<ReturnType<typeof loadRepairOps>>, slug: string, site: SiteInfo) {
  if (!loadVercelCredentials()) {
    return NextResponse.json({ error: 'No VERCEL_TOKEN — cannot resolve the live host.' }, { status: 400 });
  }
  const vercel = await loadVercelSync();
  const domains = await vercel.listProjectDomains(site.slug).catch(() => null);
  const resolved = resolveLiveUrl(domains?.ok ? domains.domains : [], site.canonical);
  if (!resolved.url || resolved.source === 'canonical') {
    return NextResponse.json(
      {
        error:
          'Vercel did not return a verified host for this site, so there is nothing safe to point the ' +
          'number at. Attach and verify a domain first.',
      },
      { status: 400 },
    );
  }

  const url = `${resolved.url.replace(/\/$/, '')}/api/voice`;
  const { twilioAccountSid, twilioAuthToken } = loadTeardownCredentials();
  const result = await ops.setTwilioWebhook({
    accountSid: twilioAccountSid,
    authToken: twilioAuthToken,
    phoneNumber: site.env.TWILIO_NUMBER,
    field: 'voiceUrl',
    url,
  });

  return settle({
    slug,
    siteSlug: site.slug,
    kind: 'twilio.voiceUrl',
    action: 'twilio.repair',
    summary: `Re-pointed ${site.env.TWILIO_NUMBER ?? 'the number'} voiceUrl to ${url}`,
    result,
  });
}

/** Restore the agent's post-call webhook to the Make clone recorded in .env.local. */
async function repairRetellWebhook(ops: Awaited<ReturnType<typeof loadRepairOps>>, slug: string, site: SiteInfo) {
  const webhookUrl = site.env.RETELL_POST_CALL_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      {
        error:
          'No RETELL_POST_CALL_WEBHOOK_URL in this site’s .env.local, so there is no known-good value ' +
          'to restore. Re-run the post-call wiring instead.',
      },
      { status: 400 },
    );
  }

  const result = await ops.setRetellAgentConfig({
    apiKey: loadRetellApiKey(),
    agentId: site.env.RETELL_AGENT_ID,
    patch: { webhook_url: webhookUrl },
  });

  return settle({
    slug,
    siteSlug: site.slug,
    kind: 'retell.webhook',
    action: 'retell.repair',
    summary: `Re-pointed the Retell post-call webhook to ${webhookUrl}`,
    result,
  });
}

/**
 * Adopt the contact number the client set in the portal as the number Twilio rings.
 *
 * This is the one repair that writes to disk rather than to a vendor, and it is the whole
 * reason Stage 4 exists: the portal saved their new number and told them it was done, while
 * `CLIENT_FORWARD_PHONE` — the value `/api/voice` actually dials — kept pointing at the old
 * one, with no error anywhere.
 *
 * Three writes, in order, and the order matters: `.env.local` is the source of truth
 * onboard.js re-reads, Vercel is what the running route sees, and a redeploy is what makes
 * Vercel's copy take effect. Stopping after the first two would leave the console claiming
 * a fix that the live site has not picked up.
 *
 * The undo restores the previous `.env.local` value. It deliberately does NOT re-sync and
 * re-deploy: undoing is the rarer, more deliberate act, and silently shipping another
 * deploy to reverse a phone number is more surprise than help. The audit line says so.
 */
async function adoptPortalForwardPhone(ctx: ClientContext, site: SiteInfo) {
  const account = await resolveAccountFor(ctx);
  const phone = account?.profile?.contactPhone?.trim();
  if (!phone) {
    return NextResponse.json(
      { error: 'The portal account has no contact number on file, so there is nothing to adopt.' },
      { status: 400 },
    );
  }

  const e164 = toE164(phone);
  if (!e164) {
    return NextResponse.json(
      {
        error:
          `"${phone}" is not a phone number we can dial. Twilio needs E.164, and writing an ` +
          'unusable value here would break inbound calls rather than fix them.',
      },
      { status: 422 },
    );
  }

  const dir = siteDirFor(ctx.slug, ctx.sites.length, ctx.sites.findIndex((s) => s.slug === site.slug));
  const before = site.env.CLIENT_FORWARD_PHONE ?? null;
  if (before && toE164(before) === e164) {
    appendAudit({
      slug: ctx.slug,
      siteSlug: site.slug,
      action: 'env.save',
      ok: true,
      summary: 'Forwarding number already matches the portal',
    });
    return NextResponse.json({ ok: true, changed: false, message: 'Already correct.' });
  }

  applyEnvUpdates(dir, { CLIENT_FORWARD_PHONE: e164 });

  const undoId = recordUndo({
    slug: ctx.slug,
    siteSlug: site.slug,
    kind: 'env.value',
    summary: `Set CLIENT_FORWARD_PHONE to the portal contact number`,
    before,
    after: e164,
  });

  // Push and redeploy so the change is live, not merely recorded. Failures here are
  // reported but do not roll back the disk write: .env.local is the source of truth, and
  // leaving it correct with a failed sync is recoverable from the Environment section.
  const warnings: string[] = [];
  try {
    const { syncEnvToVercel, triggerRedeploy } = await loadVercelSync();
    await syncEnvToVercel({ slug: site.slug, clientDir: dir, log: () => {} });
    await triggerRedeploy({ slug: site.slug, log: () => {} });
  } catch (err) {
    warnings.push(
      `Wrote .env.local, but the Vercel sync or redeploy failed: ${
        err instanceof Error ? err.message : String(err)
      }. The live site is still ringing the old number — push it from Environment.`,
    );
  }

  appendAudit({
    slug: ctx.slug,
    siteSlug: site.slug,
    action: 'env.save',
    ok: warnings.length === 0,
    summary: `Adopted the portal contact number as CLIENT_FORWARD_PHONE`,
    detail: { undoId, keys: ['CLIENT_FORWARD_PHONE'], warnings: warnings.length },
  });

  return NextResponse.json({ ok: true, changed: true, undoId, warnings });
}

/** Switch a deactivated post-call scenario back on. */
async function activateMakeScenario(
  ops: Awaited<ReturnType<typeof loadRepairOps>>,
  slug: string,
  site: SiteInfo,
  scenarioId: number | string | undefined,
) {
  if (!scenarioId) {
    return NextResponse.json(
      { error: 'No scenarioId — re-run the sweep so the finding can supply it.' },
      { status: 400 },
    );
  }

  const result = await ops.setMakeScenarioState({
    apiKey: loadMakeApiKey(),
    zone: MAKE_ZONE,
    scenarioId,
    active: true,
  });

  return settle({
    slug,
    siteSlug: site.slug,
    kind: 'make.scenarioState',
    action: 'make.repair',
    summary: `Reactivated Make scenario ${scenarioId}`,
    result,
  });
}
