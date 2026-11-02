import 'server-only';
import { createHash } from 'node:crypto';
import { getClientContext } from './clients';
import { loadRetellApiKey, loadTeardownCredentials } from './opsSecrets';
import { loadTeardownOps } from './teardownOps';
import { planEditError } from './planChange';

/**
 * What a growth → starter downgrade actually changes, verified rather than assumed.
 *
 * **A downgrade destroys nothing.** Starter and Growth run the identical voice stack: the
 * number rings the owner first, the agent picks up on no-answer, the Make webhook fires, the
 * Airtable row is written and the owner is texted that a lead is waiting in their portal.
 * Three things differ, and only three:
 *
 *   • CRM access — portal-side, gated on `plan` being growth/enterprise
 *   • web-form behaviour — Growth has the agent call the submitter back and put what it
 *     collects in the inbox; Starter drops the submission straight into the inbox
 *   • the included-minutes allowance — `MinuteCaps` is keyed by plan
 *
 * Two of those three need no work here: both follow from `PortalSite.plan`, which
 * `mirrorPlanToPortal` already writes. The only env change is `LEAD_CALLBACK` → `off`.
 *
 * This file used to describe the opposite, and the code matched the description: it released
 * the Twilio number ("back to the pool, cannot be re-acquired") and deleted the Retell agent
 * and its LLM. That was correct before the 2026-10-12 reprice, when Starter had no
 * receptionist. Afterwards it silently became a flow that strips a paying Starter client of
 * the receptionist they are entitled to and surrenders a number that cannot be recovered —
 * the plan table in CLAUDE.md has given Starter ✓ voice agent and ✓ Twilio number since.
 *
 * The probes are kept, and `teardownPlan.ts` is still the separate thing that destroys a
 * whole client. Here they verify that the stack the client keeps is actually healthy, which
 * is the same reason teardownPlan.ts makes real requests: "should exist because .env.local
 * says so" is a different claim from "exists right now".
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
  /**
   * The voice stack. All three are reported so the operator can see they SURVIVE.
   *
   * This flow used to release the number — "back to the pool, cannot be re-acquired" — and
   * delete the agent and its LLM, because it was written when Starter had no receptionist.
   * Since the 2026-10-12 reprice every tier has one, and Starter's is identical to Growth's:
   * it rings the owner first, falls back to the agent, fires the Make webhook, writes the
   * Airtable row and texts the owner. Downgrading a paying client used to strip all of that
   * and surrender a number that cannot be got back.
   */
  twilio: { number: string | null; owned: boolean | null };
  retell: { agentId: string | null; agentExists: boolean | null; llmId: string | null };
  /** Reported so the operator can see it survives. Never destroyed by this flow. */
  airtable: { baseId: string | null; baseName: string | null; exists: boolean | null };
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

  // No lead-email keys are computed, because email is not a lead delivery mode. Every tier
  // captures web-form leads into the client's portal; `LEAD_DELIVERY_MODE` is always `portal`
  // and `checkEnvTierMatrix` fails a client carrying a Resend leftover. This flow used to
  // write LEAD_DELIVERY_MODE=email, RESEND_FROM_EMAIL and LEAD_TO_EMAIL, and to warn the
  // operator that lead emails would not send until they added RESEND_API_KEY — instructing
  // them, step by step, into the exact state the correctness checks reject.

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
    warnings,
  };
}
