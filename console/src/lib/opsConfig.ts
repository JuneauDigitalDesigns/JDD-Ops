import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { opsRoot } from './paths';
import type { EnvMode, OpsConfig } from './types';
import { loadKvCredentials } from './opsSecrets';
import { kvHostSignal, keyPrefixSignal, type EnvSignal } from './envSignals';

// Reads a SPECIFIC set of non-secret context values from the master env files so the runbook
// can show operators the real value to copy (a webhook URL, the GitHub org, the GA service
// account email) instead of just "paste the value". Strictly whitelisted — never returns API
// keys or tokens. process.cwd() is the runbook app dir; opsRoot() is jdd-ops.

/** Minimal .env parser → flat map (mirrors readEnvLocal; tolerates quotes). */
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

/** Parse the GA service account JSON blob and pull only client_email. */
function serviceAccountEmail(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { client_email?: string };
    return parsed.client_email || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Classify the environment from hosts and key prefixes only. KV is the host the console
 * actually resolves (after loadKvCredentials), not just what jdd-ops/.env says, because a
 * stray override is exactly how this drifted. Unknown signals are ignored for the verdict
 * (a missing key is not evidence of test), but an all-unknown result reads as `test` so the
 * production banner never appears without positive evidence.
 */
function computeEnvMode(ops: Record<string, string>): {
  envMode: EnvMode;
  envSignals: NonNullable<OpsConfig['envSignals']>;
} {
  loadKvCredentials();
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const stripeKeys = [
    process.env.STRIPE_READONLY_KEY ?? ops.STRIPE_READONLY_KEY,
    process.env.STRIPE_SECRET_KEY ?? ops.STRIPE_SECRET_KEY,
    process.env.STRIPE_LIVE_SECRET_KEY ?? ops.STRIPE_LIVE_SECRET_KEY,
  ];
  const stripeSignals = stripeKeys.map(keyPrefixSignal).filter((s) => s !== 'unknown');
  // A test key alongside a live one is flagged as a disagreement below (stripeSelfMixed).
  const stripe: EnvSignal = stripeSignals.includes('test')
    ? 'test'
    : stripeSignals.includes('production')
      ? 'production'
      : 'unknown';

  const envSignals: NonNullable<OpsConfig['envSignals']> = [
    { label: 'KV (Upstash)', signal: kvHostSignal(kvUrl) },
    { label: 'Clerk', signal: keyPrefixSignal(process.env.CLERK_SECRET_KEY ?? ops.CLERK_SECRET_KEY) },
    { label: 'Stripe', signal: stripe },
  ];
  // Stripe keys that disagree among themselves is itself a mixed state.
  const stripeSelfMixed = stripeSignals.includes('test') && stripeSignals.includes('production');

  const known = envSignals.filter((s) => s.signal !== 'unknown').map((s) => s.signal);
  let envMode: EnvMode;
  if (stripeSelfMixed || (known.includes('production') && known.includes('test'))) envMode = 'mixed';
  else if (known.length > 0 && known.every((s) => s === 'production')) envMode = 'production';
  else envMode = 'test';
  if (stripeSelfMixed) {
    envSignals[2] = { label: 'Stripe (keys disagree)', signal: 'unknown' };
  }
  return { envMode, envSignals };
}

export function readOpsConfig(): OpsConfig {
  const root = opsRoot();
  const ops = parseEnvFile(resolve(root, '.env'));

  // Agency repo sits next to jdd-ops; prefer .env.local then .env.
  const agencyDir = resolve(root, '..', 'juneau-digital-designs');
  const agency = { ...parseEnvFile(resolve(agencyDir, '.env')), ...parseEnvFile(resolve(agencyDir, '.env.local')) };

  // The agency site's PUBLIC origin, for building links back into it — the leads board
  // deep-links a prospect straight to /agreement.
  //
  // Deliberately NOT just `agency.NEXT_PUBLIC_SITE_URL`: that file is the agency's local
  // .env.local, where it's http://localhost:3000, and a localhost link is worthless the
  // moment you send it to someone. These links always leave this machine, so a dev-only
  // origin is never the right answer. Override with JDD_SITE_URL in jdd-ops/.env if the
  // domain ever changes.
  const configured = ops.JDD_SITE_URL || agency.NEXT_PUBLIC_SITE_URL || '';
  const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(configured);
  const siteUrl = (isLocal || !configured ? 'https://juneaudigitaldesigns.com' : configured).replace(/\/$/, '');

  const signInPath = agency.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/portal/sign-in';
  const portalSignInUrl = signInPath.startsWith('http') ? signInPath : `${siteUrl}${signInPath}`;

  const { envMode, envSignals } = computeEnvMode(ops);

  // Explicit, by-name reads only. No spreading of the env maps into the result.
  return {
    envMode,
    envSignals,
    siteUrl,
    retellPostCallWebhookUrl: ops.RETELL_POST_CALL_WEBHOOK_URL || undefined,
    githubOrg: ops.GITHUB_ORG || undefined,
    vercelTeamId: ops.VERCEL_TEAM_ID || undefined,
    makePostCallMasterScenarioId: ops.MAKE_POST_CALL_MASTER_SCENARIO_ID || undefined,
    portalSignInUrl,
    serviceAccountEmail: serviceAccountEmail(ops.GOOGLE_SERVICE_ACCOUNT_KEY || agency.GOOGLE_SERVICE_ACCOUNT_KEY),
  };
}
