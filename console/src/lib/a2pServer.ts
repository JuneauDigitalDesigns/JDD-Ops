import 'server-only';
import { accountStoreConfigured, getAccountEmailByUserId, patchSite } from './accountStore';
import type { ClientContext } from './types';
import { loadIdentity, loadRegister, loadStore } from './a2pChain';
import { loadA2pEnv } from './opsSecrets';
import { appendAudit } from './audit';

/**
 * Server-side glue the A2P routes share: which of a client's sites have a number to attach,
 * and pushing the derived `a2pStatus` onto each site's portal record.
 */

/** Site slug → E.164 TWILIO_NUMBER, for every site that has one. */
export function siteNumbers(ctx: ClientContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const site of ctx.sites) {
    const n = (site.env.TWILIO_NUMBER ?? '').trim();
    if (n) out[site.slug] = n;
  }
  return out;
}

/**
 * Mirror the derived status onto every site's `PortalSite.a2pStatus` (plan decision 6).
 *
 * Only `a2pStatus` — never `messagingServiceSid`. Who owns that field's source of truth is
 * the orchestrator's §6 item 5, and writing it early would let a portal treat a service whose
 * campaign is still in review as ready. A site with no portal account yet is a normal state,
 * reported as a note.
 */
export async function syncPortalStatus(
  ctx: ClientContext,
  status: string,
): Promise<Array<{ site: string; ok: boolean; note?: string }>> {
  if (!accountStoreConfigured()) return [{ site: ctx.slug, ok: false, note: 'KV not configured — portal status not updated.' }];
  const results: Array<{ site: string; ok: boolean; note?: string }> = [];
  for (const site of ctx.sites) {
    const clerk = (site.env.CLERK_USER_ID ?? '').trim();
    if (!clerk) {
      results.push({ site: site.slug, ok: false, note: 'No CLERK_USER_ID — portal record left alone.' });
      continue;
    }
    try {
      const email = await getAccountEmailByUserId(clerk);
      if (!email) {
        results.push({ site: site.slug, ok: false, note: 'No portal account linked yet.' });
        continue;
      }
      const res = await patchSite(email, site.slug, { a2pStatus: status as never });
      results.push(res.ok ? { site: site.slug, ok: true } : { site: site.slug, ok: false, note: res.error });
    } catch (err) {
      results.push({ site: site.slug, ok: false, note: err instanceof Error ? err.message : 'Portal update failed.' });
    }
  }
  return results;
}

/** Steps that submit for review or incur a fee. The route's confirm rules key off this. */
export const FILING_STEPS = new Set(['profile.submit', 'trust.submit', 'brand.register', 'campaign.create']);

export interface A2pStepRequest {
  input?: Record<string, unknown>;
  /** Sent only by the confirm dialog. Required for every write. */
  confirm?: boolean;
  /** The client slug typed back. Required for FILING_STEPS. */
  confirmSlug?: string;
}

/**
 * THE server entry point for one registration step — every caller goes through here: the
 * /manage route today, and any other console flow (the sales-call wizard) that needs to drive
 * the chain. It enforces the confirm rules, fills a number from the site's own .env.local,
 * runs the step via `runStep` (readiness + order + the step's own guards), persists each SID
 * as it lands, pushes the derived `a2pStatus` to the portal, and audits key-free.
 *
 * Never log `request`. It may carry an EIN or a person's details, for this one call only.
 */
export async function runA2pStepForClient(
  ctx: ClientContext,
  step: string,
  request: A2pStepRequest,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const body = request;
  const input: Record<string, unknown> = { ...(body.input ?? {}) };
  // Every string the operator typed, for scrubbing a non-vendor error. Never logged.
  const submitted = Object.values(input).filter((v): v is string => typeof v === 'string' && v.trim().length >= 4);

  const [register, store, identity] = await Promise.all([loadRegister(), loadStore(), loadIdentity()]);
  const def = register.STEPS.find((s) => s.id === step);
  if (!def) return { status: 404, json: { error: `Unknown step "${step}".` } };

  if (def.write) {
    if (body.confirm !== true) {
      return { status: 400, json: { error: 'Every A2P write must be confirmed in the dialog.' } };
    }
    if (FILING_STEPS.has(step) && body.confirmSlug !== ctx.slug) {
      return { status: 400, json: { error: `Type the client slug (${ctx.slug}) to confirm this filing.` } };
    }
  }

  // The number to attach comes from the site's own .env.local, never from the browser.
  const numbers = siteNumbers(ctx);
  if (step === 'number.attach') {
    const siteSlug = String(input.siteSlug ?? '');
    if (!numbers[siteSlug]) return { status: 400, json: { error: `${siteSlug || 'That site'} has no TWILIO_NUMBER.` } };
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
    return { status: 200, json: { ok: true, summary: result.summary, record: result.record, portalStatus: statusAfter, portal } };
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Step failed.';
    const message = identity.findTaxIdPaths(raw).length ? 'Step failed (message withheld: it contained a tax-ID-shaped value).' : scrubSubmitted(raw, submitted);
    const refused = err instanceof register.A2pStepRefused;
    audit(store, { slug: ctx.slug, ok: false, summary: `A2P ${def.label} ${refused ? 'refused' : 'failed'}: ${message}`, step });
    // A partial step may have saved SIDs before failing; hand back what the store now holds.
    const record = await store.readRegistration({ slug: ctx.slug }).catch(() => before);
    return { status: refused ? 409 : 502, json: { ok: false, error: message, refused, record } };
  }
}

/** Remove every submitted value from a message. Belt and braces over A2pVendorError's own scrub. */
function scrubSubmitted(message: string, submitted: string[]): string {
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
