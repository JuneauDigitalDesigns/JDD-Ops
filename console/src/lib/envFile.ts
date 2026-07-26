import 'server-only';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * In-place editor for clients/{slug}/.env.local.
 *
 * Disk stays the source of truth: onboard.js regenerates this file on every run and
 * preserves existing values via its `keep()` helper, so an edit made here survives a
 * re-provision. Writing only to Vercel would be silently reverted by the next run.
 *
 * Rewrites matched lines in place so ordering, spacing, and the file's comments are
 * preserved; genuinely new keys are appended. Read side stays with intake.ts's
 * readEnvLocal — this module only handles writes.
 */

export function envLocalPath(dir: string): string {
  return resolve(dir, '.env.local');
}

export interface EnvWriteResult {
  path: string;
  updated: string[]; // keys whose value changed
  added: string[]; // keys that weren't in the file
  unchanged: string[]; // keys submitted with the value already on disk
}

/**
 * Apply key → value updates to a client's .env.local.
 *
 * @param dir      clients/{slug} (or clients/{slug}/site-N for enterprise sites)
 * @param updates  keys to set; a value of '' clears the key to an empty assignment
 */
export function applyEnvUpdates(dir: string, updates: Record<string, string>): EnvWriteResult {
  const path = envLocalPath(dir);
  const existed = existsSync(path);
  const original = existed ? readFileSync(path, 'utf8') : '';
  // Match the file's existing line endings so a Windows-authored file stays CRLF.
  const eol = original.includes('\r\n') ? '\r\n' : '\n';

  const lines = existed ? original.split(/\r?\n/) : [];
  const pending = new Map(Object.entries(updates));
  const updated: string[] = [];
  const unchanged: string[] = [];

  const next = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const eq = t.indexOf('=');
    if (eq === -1) return line;

    const key = t.slice(0, eq).trim();
    if (!pending.has(key)) return line;

    const value = pending.get(key) as string;
    pending.delete(key);
    if (t.slice(eq + 1).trim() === value) {
      unchanged.push(key);
      return line;
    }
    updated.push(key);
    return `${key}=${value}`;
  });

  // Anything left is a key the file didn't have — append it.
  const added = [...pending.keys()];
  if (added.length) {
    while (next.length && next[next.length - 1].trim() === '') next.pop();
    for (const [key, value] of pending) next.push(`${key}=${value}`);
  }

  if (updated.length || added.length) {
    const body = next.join(eol).replace(/(\r?\n)*$/, '') + eol;
    writeFileSync(path, body, 'utf8');
  }

  return { path, updated, added, unchanged };
}
