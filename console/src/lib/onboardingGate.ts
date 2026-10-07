import 'server-only';
import { cache } from 'react';
import { NextResponse } from 'next/server';
import { accountStoreConfigured, getAccount } from './accountStore';
import {
  clientRecordsConfigured,
  getClientRecordBySlug,
  isSlugOnboarded,
  markSlugOnboarded,
} from './clientRecord';
import { getClientContext } from './clients';
import type { ClientContext } from './types';

/**
 * Build and Onboard stay locked until the client has filled out their onboarding on the agency
 * site. This file is the single answer to "has that happened yet?", and the layout, the page
 * redirects and the API guards all ask it, so they can't drift apart.
 *
 * What is gated: a client the operator created by converting a lead. That folder is only a
 * placeholder seeded from a vertical preset, so building it would mean building nothing. Clients
 * that arrived any other way (an imported intake, or anything already built before this gate
 * existed) are past the point the gate protects and are never locked.
 *
 * Unlock, in order:
 *   1. The folder is already built or provisioned: real work exists, nothing to protect.
 *   2. `jdd:client:onboarded:{slug}` is set: an intake was imported, or we saw the account
 *      onboard once and remembered it.
 *   3. The client record has no `leadId`: it did not come through the funnel, so it was never
 *      a placeholder.
 *   4. The client's portal account, found by EMAIL (the Clerk signup email, carried on the
 *      record), has a site whose status is past `pending-onboarding`.
 *
 * A guardrail, not security: the console has no auth, and a console with no KV must still work
 * in dev. So every path that can't decide fails OPEN.
 */

export const ONBOARDING_LOCK_REASON =
  'Waiting on the client to finish onboarding on the agency site. Send them the signup link from Manage.';

export interface OnboardingGate {
  onboarded: boolean;
  /** The address the welcome email goes to, when we have one. */
  email: string | null;
  /** User-facing lock reason; null once onboarded. */
  reason: string | null;
}

const OPEN: OnboardingGate = { onboarded: true, email: null, reason: null };

type GateCtx = Pick<ClientContext, 'slug' | 'repoBuilt' | 'detectedStatus'>;

/**
 * Per-request memo, the same treatment getClientCached gets. The client layout, the shell
 * entry, and the tool pages each ask this on one page load, and each is up to three KV reads.
 * `cache` keys on the ctx object, which getClientCached hands every caller as one instance.
 */
export const getOnboardingGate = cache(async (ctx: GateCtx): Promise<OnboardingGate> => {
  // 1: built or provisioned already. `unknown` is a folder we couldn't read, which proves nothing.
  if (ctx.repoBuilt) return OPEN;
  if (ctx.detectedStatus !== 'needs-build' && ctx.detectedStatus !== 'unknown') return OPEN;

  if (!clientRecordsConfigured() || !accountStoreConfigured()) return OPEN;

  try {
    // 2
    if (await isSlugOnboarded(ctx.slug)) return OPEN;

    // 3
    const record = await getClientRecordBySlug(ctx.slug);
    if (!record || !record.leadId) return OPEN;

    // 4
    const account = record.email ? await getAccount(record.email) : null;
    const onboarded = Boolean(
      account?.sites.some(
        (s) => s.status === 'building' || s.status === 'live' || Boolean(s.onboardingCompletedAt),
      ),
    );
    if (onboarded) {
      // Best-effort: remembering it only saves a lookup, and must never fail the page.
      await markSlugOnboarded(ctx.slug).catch(() => {});
      return { onboarded: true, email: record.email, reason: null };
    }
    return { onboarded: false, email: record.email, reason: ONBOARDING_LOCK_REASON };
  } catch (e) {
    console.error('[onboardingGate] could not decide, failing open', e);
    return OPEN;
  }
});

/**
 * The third enforcement layer: a 403 for an API route to return when its client is still
 * locked, or null to carry on. Routes call it right after validating the slug.
 *
 * A slug with no folder returns null on purpose. Not-found is the route's own answer to give,
 * and this guard existing must not turn it into a misleading 403.
 */
export async function guardOnboarded(slug: string): Promise<NextResponse | null> {
  const reason = await lockedReason(slug);
  return reason ? NextResponse.json({ error: reason, locked: true }, { status: 403 }) : null;
}

/**
 * The lock reason for a slug, or null when it may proceed. For the NDJSON-streaming routes
 * (export, onboard), which report failure as an `error` event rather than an HTTP status.
 */
export async function lockedReason(slug: string): Promise<string | null> {
  const ctx = await getClientContext(slug);
  if (!ctx) return null;
  const gate = await getOnboardingGate(ctx);
  return gate.onboarded ? null : (gate.reason ?? ONBOARDING_LOCK_REASON);
}
