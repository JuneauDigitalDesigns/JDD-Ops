import 'server-only';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readAgencyEnv, readOpsEnv, opsEnvPath } from './env';
import type { GoLiveResult } from './types';

/**
 * Keep jdd-ops/.env in step with the agency app for the handful of values whose source of
 * truth is the app, so `audit-billing.js` and the console never read stale IDs.
 *
 * Deliberately a SHORT whitelist. Master credentials (Twilio auth, Retell, Airtable, GitHub,
 * Vercel, Anthropic) live in jdd-ops/.env as their own source and are never overwritten from
 * the agency side. The Stripe SECRET key is also never synced — the console runs on its own
 * restricted read-only key on purpose.
 */
const SYNC_KEYS = [
  'STRIPE_PRICE_STARTER_MONTHLY',
  'STRIPE_PRICE_STARTER_ONBOARDING',
  'STRIPE_PRICE_GROWTH_MONTHLY',
  'STRIPE_PRICE_ENTERPRISE_MONTHLY',
  'OPS_SHARED_SECRET',
  'TWILIO_MESSAGING_SERVICE_SID',
] as const;

/** Mask a value so a diff never prints a secret in full. */
function mask(v: string): string {
  if (v.length <= 8) return '••••';
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export function runEnvSync(dryRun: boolean): GoLiveResult {
  const agency = readAgencyEnv();
  const ops = readOpsEnv();

  const changes: { key: string; from?: string; to: string }[] = [];
  const skipped: string[] = [];

  for (const key of SYNC_KEYS) {
    const next = agency[key];
    if (!next) {
      skipped.push(`${key}: not set in the agency env`);
      continue;
    }
    if (ops[key] === next) continue; // already in step
    changes.push({ key, from: ops[key], to: next });
  }

  const lines = [
    ...changes.map((c) => `~ ${c.key}: ${c.from ? mask(c.from) : '(unset)'} → ${mask(c.to)}`),
    ...skipped.map((s) => `· ${s}`),
  ];

  if (changes.length === 0) {
    return { ok: true, dryRun, title: 'Env sync', summary: 'jdd-ops/.env already matches the agency app.', lines };
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      title: 'Env sync — preview',
      summary: `${changes.length} value${changes.length === 1 ? '' : 's'} would be written to jdd-ops/.env.`,
      lines,
    };
  }

  // Line-based rewrite: replace an existing `KEY=…` line in place, else append. Preserves
  // comments and ordering; atomic tmp+rename so a crash can't truncate the file.
  const path = opsEnvPath();
  const original = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const rows = original.length ? original.split(/\r?\n/) : [];
  const remaining = new Map(changes.map((c) => [c.key, c.to]));

  const updated = rows.map((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m && remaining.has(m[1])) {
      const key = m[1];
      const val = remaining.get(key)!;
      remaining.delete(key);
      return `${key}=${val}`;
    }
    return line;
  });
  for (const [key, val] of remaining) updated.push(`${key}=${val}`);

  const body = updated.join(eol);
  const tmp = resolve(path, `../.env.${process.pid}.tmp`);
  writeFileSync(tmp, body.endsWith(eol) ? body : body + eol, 'utf8');
  renameSync(tmp, path);

  return {
    ok: true,
    dryRun: false,
    title: 'Env sync',
    summary: `Wrote ${changes.length} value${changes.length === 1 ? '' : 's'} to jdd-ops/.env.`,
    lines,
  };
}
