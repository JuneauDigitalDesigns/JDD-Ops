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
