import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { opsRoot } from './paths';

/**
 * Secret reads from jdd-ops/.env — the deliberate counterpart to opsConfig.ts.
 *
 * opsConfig.ts exists to surface *non-secret* context to the UI and is documented as
 * "never returns API keys or tokens". That rule still holds: nothing here is ever put
 * in a response body. These values are loaded into process.env so lib/vercel-sync.js
 * (which reads process.env.VERCEL_TOKEN at call time) works inside the console, the
 * same way `dotenv/config` does it for the CLI scripts.
 */

/** Minimal .env parser → flat map (mirrors opsConfig.parseEnvFile; tolerates quotes). */
function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val) out[key] = val;
  }
  return out;
}

/** Keys the Vercel sync needs. GITHUB_ORG is only used to create/deploy from the repo. */
const VERCEL_KEYS = ['VERCEL_TOKEN', 'VERCEL_TEAM_ID', 'GITHUB_ORG'] as const;

/**
 * Copy the Vercel credentials from jdd-ops/.env into process.env (without clobbering
 * anything already set, so console/.env.local can still override for testing).
 * Idempotent — safe to call at the top of every request.
 *
 * @returns whether VERCEL_TOKEN ended up available.
 */
export function loadVercelCredentials(): boolean {
  const ops = parseEnvFile(resolve(opsRoot(), '.env'));
  for (const key of VERCEL_KEYS) {
    if (!process.env[key] && ops[key]) process.env[key] = ops[key];
  }
  return Boolean(process.env.VERCEL_TOKEN);
}

/**
 * KV (Upstash) credentials for every console store (accounts, leads, intake, tickets,
 * client records, reconcile, cancel/featured). Copies the production pair out of
 * jdd-ops/.env into process.env without clobbering an existing value, so the console reads
 * the SAME instance as the agency site. Idempotent; safe to call per request.
 *
 * This is the single source of truth: console/.env.local must NOT define KV_* anymore,
 * or it would re-introduce the test/prod drift this replaced.
 */
export function loadKvCredentials(): boolean {
  const ops = parseEnvFile(resolve(opsRoot(), '.env'));
  const keys = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'KV_REST_API_READ_ONLY_TOKEN'] as const;
  for (const key of keys) {
    if (!process.env[key] && ops[key]) process.env[key] = ops[key];
  }
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}

/**
 * Hostname of the KV instance recorded in jdd-ops/.env (the production one). Read-only,
 * does not touch process.env, never returns the token. Used by the kv-reset guard.
 */
export function opsKvHost(): string | null {
  const ops = parseEnvFile(resolve(opsRoot(), '.env'));
  const url = ops.KV_REST_API_URL || ops.UPSTASH_REDIS_REST_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * The master Retell key, for pushing a tuned agent prompt from /manage. Same contract as
 * loadVercelCredentials: copies out of jdd-ops/.env into process.env, never into a
 * response body.
 *
 * Returns the key rather than a boolean because, unlike the Vercel path (where
 * lib/vercel-sync.js reads process.env itself), the caller does the fetch.
 */
export function loadRetellApiKey(): string | null {
  if (!process.env.RETELL_API_KEY) {
    const ops = parseEnvFile(resolve(opsRoot(), '.env'));
    if (ops.RETELL_API_KEY) process.env.RETELL_API_KEY = ops.RETELL_API_KEY;
  }
  return process.env.RETELL_API_KEY ?? null;
}

/**
 * The org PAT, for pushing a client repo from the studio's Deploy button.
 *
 * Without it the push falls back to whatever the ambient credential helper offers, and on a
 * machine where that helper wants to prompt, the push blocks forever — taking the deploy's
 * NDJSON stream with it. onboard.js has always injected this token for exactly the same reason
 * (see its git push at step 8); the console just never did.
 *
 * Same contract as the rest of this module: the value goes into the git invocation and nowhere
 * else. It must never reach a response body — the export route redacts it out of command output
 * before streaming anything back.
 */
export function loadGithubToken(): string | null {
  if (!process.env.GITHUB_TOKEN) {
    const ops = parseEnvFile(resolve(opsRoot(), '.env'));
    if (ops.GITHUB_TOKEN) process.env.GITHUB_TOKEN = ops.GITHUB_TOKEN;
  }
  return process.env.GITHUB_TOKEN ?? null;
}

/**
 * The Make.com API key, for resolving and deleting a client's post-call scenario clone
 * during teardown. Same contract as the rest of this module.
 */
export function loadMakeApiKey(): string | null {
  if (!process.env.MAKE_API_KEY) {
    const ops = parseEnvFile(resolve(opsRoot(), '.env'));
    if (ops.MAKE_API_KEY) process.env.MAKE_API_KEY = ops.MAKE_API_KEY;
  }
  return process.env.MAKE_API_KEY ?? null;
}

/**
 * The Vercel Blob read/write token, for the /manage → Featured publish flow to upload a
 * client's screenshot straight to the agency site's blob store. Same contract as the rest
 * of this module — the value goes to `@vercel/blob` and nowhere else, never a response body.
 *
 * This is the agency Vercel project's token: uploads must land in the store the deployed
 * homepage serves from. The console is local-only, so it holds it in jdd-ops/.env alongside
 * VERCEL_TOKEN rather than getting it from a Vercel runtime env.
 */
export function loadBlobToken(): string | null {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const ops = parseEnvFile(resolve(opsRoot(), '.env'));
    if (ops.BLOB_READ_WRITE_TOKEN) process.env.BLOB_READ_WRITE_TOKEN = ops.BLOB_READ_WRITE_TOKEN;
  }
  return process.env.BLOB_READ_WRITE_TOKEN ?? null;
}

/**
 * The Stripe key, for looking up a client's subscription from /manage → Portal when the
 * portal record lost its `stripeSubscriptionId`.
 *
 * Prefers `STRIPE_READONLY_KEY` and only falls back to `STRIPE_SECRET_KEY`. The console has
 * **no auth of any kind**, so a restricted read-only key is strongly preferred here: the one
 * route that uses this can only list customers and subscriptions, but a full secret key
 * sitting in this process is a much larger blast radius than the feature needs.
 *
 * Same contract as the rest of this module — the value goes to Stripe and nowhere else, and
 * must never reach a response body.
 */
/**
 * `mode` is derived from the key prefix and must be surfaced anywhere money is shown.
 *
 * The console is currently configured with a TEST key, which means every figure it can
 * report — MRR on the briefing, the subscription on the Account phase, plan drift in
 * audit-billing — is test data. A dashboard that prints "$297/mo active" without saying
 * which Stripe it came from is worse than one that prints nothing: it looks exactly like
 * revenue. The orphan scan surfaced 22 active subscriptions for one address before this
 * distinction existed, which reads as alarming until you know the mode.
 *
 * Never returns or logs the key itself; only which of the two it came from and its prefix.
 */
export function loadStripeKey(): {
  key: string | null;
  restricted: boolean;
  mode: 'test' | 'live' | 'unknown' | null;
} {
  const ops = parseEnvFile(resolve(opsRoot(), '.env'));
  const readonly = process.env.STRIPE_READONLY_KEY ?? ops.STRIPE_READONLY_KEY ?? null;
  if (readonly) return { key: readonly, restricted: true, mode: stripeMode(readonly) };
  const secret = process.env.STRIPE_SECRET_KEY ?? ops.STRIPE_SECRET_KEY ?? null;
  return {
    key: secret,
    restricted: secret ? secret.startsWith('rk_') : false,
    mode: stripeMode(secret),
  };
}

function stripeMode(key: string | null): 'test' | 'live' | 'unknown' | null {
  if (!key) return null;
  if (/^(sk|rk)_test_/.test(key)) return 'test';
  if (/^(sk|rk)_live_/.test(key)) return 'live';
  return 'unknown';
}

/**
 * The portal app's base URL and the shared secret for calling its `/api/ops/*` routes.
 *
 * The console never calls Stripe to *write*. `stripe-lookup` is read-only permanently and
 * says so; a write path behind a console with no authentication is a different category of
 * risk. So when billing has to change, the console asks the portal app — which is deployed,
 * gates the route on this secret, and already holds the write-capable Stripe key.
 *
 * `PORTAL_BASE_URL` should normally point at production: an ops action that moves money
 * should act on the real subscription, not on whatever happens to be running on localhost.
 */
export function loadPortalOpsConfig(): { baseUrl: string | null; secret: string | null } {
  const ops = parseEnvFile(resolve(opsRoot(), '.env'));
  const baseUrl =
    process.env.PORTAL_BASE_URL ?? ops.PORTAL_BASE_URL ?? 'https://juneaudigitaldesigns.com';
  const secret = process.env.OPS_SHARED_SECRET ?? ops.OPS_SHARED_SECRET ?? null;
  return { baseUrl: baseUrl.replace(/\/+$/, '') || null, secret };
}

/**
 * Every other credential teardown needs and this module doesn't already load:
 * TWILIO_ACCOUNT_SID/AUTH_TOKEN, AIRTABLE_API_KEY, CLERK_SECRET_KEY. Grouped because
 * teardown always wants the full set at once, unlike the single-purpose loaders above.
 */
export function loadTeardownCredentials(): {
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioMessagingServiceSid: string | null;
  airtableApiKey: string | null;
  clerkSecretKey: string | null;
} {
  const ops = parseEnvFile(resolve(opsRoot(), '.env'));
  const pick = (key: string) => process.env[key] ?? ops[key] ?? null;
  return {
    twilioAccountSid: pick('TWILIO_ACCOUNT_SID'),
    twilioAuthToken: pick('TWILIO_AUTH_TOKEN'),
    twilioMessagingServiceSid: pick('TWILIO_MESSAGING_SERVICE_SID'),
    airtableApiKey: pick('AIRTABLE_API_KEY'),
    clerkSecretKey: pick('CLERK_SECRET_KEY'),
  };
}
