import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { opsRoot } from '@/lib/paths';

/**
 * Env readers for the go-live checks. Two surfaces live on this machine and both matter:
 *   - jdd-ops/.env        — master ops creds + the Stripe read + price IDs the console/scripts use.
 *   - agency .env.local   — the portal app's env (Stripe/Clerk/KV/Turnstile/…), which is the
 *                           local mirror of what should be set on the agency Vercel project.
 *
 * The agency repo sits next to jdd-ops on disk — the same resolution opsConfig.ts uses.
 *
 * These are read-only parses. Nothing here is ever returned to a response body; the go-live
 * actions only ever report booleans and prefixes derived from them (e.g. "starts with sk_live_").
 */

export function parseEnvFile(path: string): Record<string, string> {
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

export function agencyRoot(): string {
  return resolve(opsRoot(), '..', 'juneau-digital-designs');
}

export function opsEnvPath(): string {
  return resolve(opsRoot(), '.env');
}

/** Prefer .env.local, fall back to .env — same order opsConfig uses. */
export function agencyEnvPath(): string {
  const local = resolve(agencyRoot(), '.env.local');
  return existsSync(local) ? local : resolve(agencyRoot(), '.env');
}

export function readOpsEnv(): Record<string, string> {
  return parseEnvFile(opsEnvPath());
}

export function readAgencyEnv(): Record<string, string> {
  return parseEnvFile(agencyEnvPath());
}

/** Cloudflare Turnstile "always passes" test keys — never valid for a real launch. */
export function isTurnstileTestKey(v: string | undefined): boolean {
  if (!v) return false;
  return /^[123]x0{20,}A{0,2}$/i.test(v) || v.startsWith('1x00000000000000000000');
}
