import 'server-only';
import { Redis } from '@upstash/redis';
import { readAgencyEnv, readOpsEnv, isTurnstileTestKey } from './env';
import type { GoLiveCheck, GoLiveResult } from './types';

/**
 * The green gate. Read-only. Reports whether every service is configured for PRODUCTION in
 * the two env surfaces this machine can see (jdd-ops/.env and the agency .env.local — the
 * local mirror of the agency Vercel project, which is the source of truth once env-sync has
 * run). It never returns a secret: only booleans and key prefixes derived from them.
 *
 * A check is `false` (red) when it's wrong, `true` (green) when right, and `null` (grey) when
 * it can't be judged here (e.g. KV creds absent so there's nothing to ping).
 */
export async function runPreflight(): Promise<GoLiveResult> {
  const agency = readAgencyEnv();
  const ops = readOpsEnv();
  const checks: GoLiveCheck[] = [];

  const present = (v: string | undefined) => Boolean(v && v.trim());
  const startsWith = (v: string | undefined, p: string) => Boolean(v && v.startsWith(p));

  // ── Stripe (agency) ────────────────────────────────────────────────────────
  checks.push({
    label: 'Stripe secret key is live',
    ok: present(agency.STRIPE_SECRET_KEY) ? startsWith(agency.STRIPE_SECRET_KEY, 'sk_live_') : false,
    detail: startsWith(agency.STRIPE_SECRET_KEY, 'sk_test_') ? 'still a test key (sk_test_)' : undefined,
  });
  checks.push({
    label: 'Stripe publishable key is live',
    ok: startsWith(agency.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, 'pk_live_'),
    detail: startsWith(agency.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, 'pk_test_') ? 'still pk_test_' : undefined,
  });
  checks.push({ label: 'Stripe webhook secret set', ok: startsWith(agency.STRIPE_WEBHOOK_SECRET, 'whsec_') });
  for (const key of [
    'STRIPE_PRICE_STARTER_MONTHLY',
    'STRIPE_PRICE_STARTER_ONBOARDING',
    'STRIPE_PRICE_GROWTH_MONTHLY',
    'STRIPE_PRICE_ENTERPRISE_MONTHLY',
  ]) {
    checks.push({ label: `${key} present`, ok: present(agency[key]) });
  }

  // ── Clerk (agency) ─────────────────────────────────────────────────────────
  checks.push({
    label: 'Clerk secret key is live',
    ok: startsWith(agency.CLERK_SECRET_KEY, 'sk_live_'),
    detail: startsWith(agency.CLERK_SECRET_KEY, 'sk_test_') ? 'still a dev instance key' : undefined,
  });
  checks.push({
    label: 'Clerk publishable key is live',
    ok: startsWith(agency.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'pk_live_'),
    detail: startsWith(agency.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'pk_test_') ? 'still a dev instance key' : undefined,
  });
  checks.push({ label: 'Clerk webhook signing secret set', ok: startsWith(agency.CLERK_WEBHOOK_SIGNING_SECRET, 'whsec_') });

  // ── Site URL (agency) ──────────────────────────────────────────────────────
  {
    const url = agency.NEXT_PUBLIC_SITE_URL ?? '';
    const isLocal = /localhost|127\.0\.0\.1/i.test(url);
    checks.push({
      label: 'Site URL is the production domain',
      ok: present(url) ? url.startsWith('https://') && !isLocal : false,
      detail: isLocal ? 'still points at localhost' : url || undefined,
    });
  }

  // ── Turnstile (agency) ─────────────────────────────────────────────────────
  checks.push({
    label: 'Turnstile keys are real (not the test keys)',
    ok:
      present(agency.NEXT_PUBLIC_TURNSTILE_SITE_KEY) && present(agency.TURNSTILE_SECRET_KEY)
        ? !isTurnstileTestKey(agency.NEXT_PUBLIC_TURNSTILE_SITE_KEY) && !isTurnstileTestKey(agency.TURNSTILE_SECRET_KEY)
        : false,
    detail: isTurnstileTestKey(agency.NEXT_PUBLIC_TURNSTILE_SITE_KEY) ? 'using the always-pass test key' : undefined,
  });

  // ── KV (agency) ────────────────────────────────────────────────────────────
  const kvUrl = agency.KV_REST_API_URL || agency.UPSTASH_REDIS_REST_URL;
  const kvToken = agency.KV_REST_API_TOKEN || agency.UPSTASH_REDIS_REST_TOKEN;
  checks.push({ label: 'KV / Upstash creds present', ok: present(kvUrl) && present(kvToken) });
  if (present(kvUrl) && present(kvToken)) {
    let reachable = false;
    try {
      const pong = await new Redis({ url: kvUrl!, token: kvToken! }).ping();
      reachable = pong === 'PONG' || pong === 'pong' || Boolean(pong);
    } catch {
      reachable = false;
    }
    checks.push({ label: 'KV reachable (ping)', ok: reachable });
  } else {
    checks.push({ label: 'KV reachable (ping)', ok: null, detail: 'no creds to ping' });
  }

  // ── Email + telephony (agency + ops) ───────────────────────────────────────
  checks.push({ label: 'Resend API key set', ok: present(agency.RESEND_API_KEY || ops.RESEND_API_KEY) });
  {
    const from = agency.QUOTE_FROM_EMAIL || ops.RESEND_FROM_EMAIL || '';
    checks.push({
      label: 'Email from-address is your domain',
      ok: present(from) ? from.includes('@juneaudigitaldesigns.com') : null,
      detail: from.includes('resend.dev') ? 'still the resend.dev sandbox' : from || undefined,
    });
  }
  checks.push({ label: 'Blob token set (featured screenshots)', ok: present(agency.BLOB_READ_WRITE_TOKEN) });
  checks.push({
    label: 'Twilio A2P messaging service set',
    ok: startsWith(agency.TWILIO_MESSAGING_SERVICE_SID || ops.TWILIO_MESSAGING_SERVICE_SID, 'MG'),
  });

  // ── Ops console + scripts (jdd-ops/.env) ───────────────────────────────────
  checks.push({
    label: 'Console Stripe key is live',
    ok:
      startsWith(ops.STRIPE_READONLY_KEY, 'rk_live_') ||
      startsWith(ops.STRIPE_SECRET_KEY, 'sk_live_') ||
      startsWith(ops.STRIPE_READONLY_KEY, 'sk_live_'),
    detail: startsWith(ops.STRIPE_READONLY_KEY, 'rk_test_') || startsWith(ops.STRIPE_SECRET_KEY, 'sk_test_') ? 'still test' : undefined,
  });
  checks.push({ label: 'Vercel token + team set', ok: present(ops.VERCEL_TOKEN) && present(ops.VERCEL_TEAM_ID) });
  checks.push({ label: 'Retell API key set', ok: present(ops.RETELL_API_KEY) });
  checks.push({ label: 'Airtable API key set', ok: present(ops.AIRTABLE_API_KEY) });
  checks.push({ label: 'GitHub token set (client repo creation)', ok: present(ops.GITHUB_TOKEN) });

  // ── Cross-surface parity ───────────────────────────────────────────────────
  checks.push({
    label: 'OPS_SHARED_SECRET matches across agency + ops',
    ok:
      present(agency.OPS_SHARED_SECRET) && present(ops.OPS_SHARED_SECRET)
        ? agency.OPS_SHARED_SECRET === ops.OPS_SHARED_SECRET
        : false,
    detail:
      present(agency.OPS_SHARED_SECRET) && present(ops.OPS_SHARED_SECRET)
        ? undefined
        : 'set the same value in both',
  });
  {
    const same =
      agency.STRIPE_PRICE_GROWTH_MONTHLY &&
      ops.STRIPE_PRICE_GROWTH_MONTHLY &&
      agency.STRIPE_PRICE_GROWTH_MONTHLY === ops.STRIPE_PRICE_GROWTH_MONTHLY;
    checks.push({
      label: 'Stripe price IDs agree (agency ↔ ops)',
      ok: agency.STRIPE_PRICE_GROWTH_MONTHLY && ops.STRIPE_PRICE_GROWTH_MONTHLY ? Boolean(same) : null,
      detail: same ? undefined : 'run env-sync so audit-billing matches the app',
    });
  }

  const failed = checks.filter((c) => c.ok === false).length;
  return {
    ok: failed === 0,
    dryRun: true,
    title: 'Production preflight',
    summary: failed === 0 ? 'All production checks pass.' : `${failed} check${failed === 1 ? '' : 's'} still failing.`,
    checks,
  };
}
