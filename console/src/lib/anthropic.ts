import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findOpsRoot } from './opsRoot';

/** ANTHROPIC_API_KEY from the process env, else the jdd-ops master .env. Server-only. */
export function getAnthropicKey(): string {
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv) return fromEnv;
  const envPath = resolve(findOpsRoot(), '.env');
  let raw: string;
  try {
    raw = readFileSync(envPath, 'utf8');
  } catch {
    throw new Error(`Could not read ${envPath}. Add ANTHROPIC_API_KEY to jdd-ops/.env.`);
  }
  const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith('ANTHROPIC_API_KEY='));
  if (!line) throw new Error('ANTHROPIC_API_KEY not found in jdd-ops/.env.');
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
}
