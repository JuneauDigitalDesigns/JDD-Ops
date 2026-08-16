import 'server-only';
import { createHash } from 'node:crypto';
import { getClientContext } from './clients';
import { loadRetellApiKey, loadTeardownCredentials } from './opsSecrets';
import { loadTeardownOps } from './teardownOps';
import { loadIntake } from './intake';
import { brandContact, planEditError, schemaPathFor } from './planChange';

/**
 * What a growth → starter downgrade would actually destroy, verified rather than assumed.
 *
 * Deliberately NOT lib/teardownPlan.ts. That builds a preview for destroying an entire
 * client — GitHub repo, Vercel project, domains, and finally clients/{slug} itself, which
 * it documents as unrecoverable. A downgrade keeps the site: same repo, same deployment,
 * same domain, same content. Only the voice tier goes away, which is two resources:
 *
 *   • the Twilio number  — released back to the pool, cannot be re-acquired
 *   • the Retell agent + its per-client LLM — deleted
 *
 * The Airtable base is deliberately KEPT and only reported, never destroyed: it holds the
 * client's call history, which stays worth having after they stop taking AI calls.
 *
 * Every field here is a real request, same as teardownPlan.ts and for the same reason —
 * "should exist because .env.local says so" is a different claim from "exists right now",
 * and the gap between them is what a destructive-action preview exists to close.
 */

export interface PlanDowngradePreview {
  slug: string;
  brandName: string;
  siteSlug: string;
  /** Always 'growth' when this preview is valid — carried so the UI can assert it. */
  plan: string;
  capturedAt: string;
  /** sha256 over the resolved resource ids — the execute call must echo this. */
  previewHash: string;
  twilio: { number: string | null; owned: boolean | null };
  retell: { agentId: string | null; agentExists: boolean | null; llmId: string | null };
  /** Reported so the operator can see it survives. Never destroyed by this flow. */
  airtable: { baseId: string | null; baseName: string | null; exists: boolean | null };
  /** Starter lead-email keys that will be written, and whether we can fill them. */
  leadEmail: { to: string | null; brandName: string | null; resendKeySet: boolean };
  /** Missing credentials or other reasons a resource couldn't be verified. */
  warnings: string[];
}

/** Stable over identifiers only — never timestamps, so an unchanged client rehashes the same. */
function hashPreview(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

/** Thrown for "this client can't be downgraded", so routes can answer 400 rather than 500. */
export class PlanDowngradeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function buildPlanDowngradePreview(slug: string): Promise<PlanDowngradePreview> {
  const ctx = await getClientContext(slug);
  if (!ctx) throw new PlanDowngradeError(`No client at clients/${slug}.`, 404);

  const blocked = planEditError(ctx, 'starter');
  if (blocked) throw new PlanDowngradeError(blocked);
  if (ctx.plan !== 'growth') {
    throw new PlanDowngradeError(`Only a growth client can be downgraded here (${slug} is ${ctx.plan}).`);
  }

  const site = ctx.sites[0];
  const env = site.env;

  const warnings: string[] = [];
  const retellKey = loadRetellApiKey();
  if (!retellKey) warnings.push('RETELL_API_KEY not set in jdd-ops/.env — the Retell agent could not be verified or deleted.');
  const { twilioAccountSid, twilioAuthToken, airtableApiKey } = loadTeardownCredentials();
  if (!twilioAccountSid || !twilioAuthToken) {
    warnings.push('Twilio credentials not set in jdd-ops/.env — the number could not be verified or released.');
  }
  if (env.AIRTABLE_BASE_ID && !airtableApiKey) {
    warnings.push('AIRTABLE_API_KEY not set — the Airtable base could not be verified (it is kept either way).');
  }

  const ops = await loadTeardownOps();

  const [twilioOwned, agentExists, resolvedLlmId, base] = await Promise.all([
    ops.probeTwilioNumber({
      accountSid: twilioAccountSid ?? undefined,
      authToken: twilioAuthToken ?? undefined,
      phoneNumber: env.TWILIO_NUMBER,
    }),
    env.RETELL_AGENT_ID
      ? ops.probeRetellAgent({ apiKey: retellKey ?? undefined, agentId: env.RETELL_AGENT_ID })
      : Promise.resolve(null),
    // The id is normally on disk (onboard.js writes it); the lookup is only a fallback,
    // and it fails silently when the agent is already gone.
    env.RETELL_LLM_ID
      ? Promise.resolve(env.RETELL_LLM_ID)
      : ops.resolveRetellLlmId({ apiKey: retellKey ?? undefined, agentId: env.RETELL_AGENT_ID }),
    env.AIRTABLE_BASE_ID
      ? ops.probeAirtableBase({ apiKey: airtableApiKey ?? undefined, baseId: env.AIRTABLE_BASE_ID })
      : Promise.resolve({ exists: null, name: null }),
  ]);

  // What the starter lead-email keys will be set to. A growth .env.local has none of
  // them, so these come from site.ts — the same source onboard.js's starter template uses.
  const { file, exists } = schemaPathFor(ctx.slug);
  const brand = brandContact(exists ? (await loadIntake(file))?.sites[0] : undefined);
  const leadTo = env.LEAD_TO_EMAIL ?? brand.email ?? null;
  if (!leadTo) {
    warnings.push('No brand.email in site.ts — LEAD_TO_EMAIL will be left empty and lead emails will have nowhere to go.');
  }
  if (!env.RESEND_API_KEY) {
    warnings.push(
      'RESEND_API_KEY is not set on this client — starter lead emails will not send until you add it in Environment. (onboard.js never seeds it either; a fresh starter client has the same gap.)',
    );
  }

  const identifiers = {
    slug: ctx.slug,
    siteSlug: site.slug,
    twilioNumber: env.TWILIO_NUMBER ?? null,
    retellAgentId: env.RETELL_AGENT_ID ?? null,
    retellLlmId: resolvedLlmId ?? null,
  };

  return {
    slug: ctx.slug,
    brandName: ctx.brandName,
    siteSlug: site.slug,
    plan: ctx.plan,
    capturedAt: new Date().toISOString(),
    previewHash: hashPreview(identifiers),
    twilio: { number: env.TWILIO_NUMBER ?? null, owned: twilioOwned },
    retell: {
      agentId: env.RETELL_AGENT_ID ?? null,
      agentExists,
      llmId: resolvedLlmId ?? null,
    },
    airtable: {
      baseId: env.AIRTABLE_BASE_ID ?? null,
      baseName: base.name,
      exists: base.exists,
    },
    leadEmail: {
      to: leadTo,
      brandName: brand.name ?? ctx.brandName,
      resendKeySet: Boolean(env.RESEND_API_KEY),
    },
    warnings,
  };
}
