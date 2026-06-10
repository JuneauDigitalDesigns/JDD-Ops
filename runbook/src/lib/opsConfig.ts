import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { opsRoot } from './paths';
import type { OpsConfig } from './types';

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

export function readOpsConfig(): OpsConfig {
  const root = opsRoot();
  const ops = parseEnvFile(resolve(root, '.env'));

  // Agency repo sits next to jdd-ops; prefer .env.local then .env.
  const agencyDir = resolve(root, '..', 'juneau-digital-designs');
  const agency = { ...parseEnvFile(resolve(agencyDir, '.env')), ...parseEnvFile(resolve(agencyDir, '.env.local')) };

  const signInPath = agency.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/portal/sign-in';
  const portalSignInUrl = signInPath.startsWith('http')
    ? signInPath
    : `https://juneaudigitaldesigns.com${signInPath}`;

  // Explicit, by-name reads only. No spreading of the env maps into the result.
  return {
    retellPostCallWebhookUrl: ops.RETELL_POST_CALL_WEBHOOK_URL || undefined,
    githubOrg: ops.GITHUB_ORG || undefined,
    vercelTeamId: ops.VERCEL_TEAM_ID || undefined,
    makeDataStoreId: ops.MAKE_DATA_STORE_ID || undefined,
    portalSignInUrl,
    serviceAccountEmail: serviceAccountEmail(ops.GOOGLE_SERVICE_ACCOUNT_KEY || agency.GOOGLE_SERVICE_ACCOUNT_KEY),
  };
}
