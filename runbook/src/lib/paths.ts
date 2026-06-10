import 'server-only';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// The runbook dev server runs with cwd = jdd-ops/runbook, so the jdd-ops root
// (which holds onboard.js, clients/, template/) is one level up. Mirrors the way
// studio/preview resolves its repo root two levels up.
export function opsRoot(): string {
  const root = resolve(process.cwd(), '..');
  if (!existsSync(resolve(root, 'onboard.js'))) {
    throw new Error(
      `Could not locate onboard.js at ${root}. Run the runbook from jdd-ops/runbook (cwd=${process.cwd()}).`,
    );
  }
  return root;
}

export function clientsDir(): string {
  return resolve(opsRoot(), 'clients');
}

/** Absolute path to a client's base folder (clients/{slug}). */
export function clientDir(baseSlug: string): string {
  return resolve(clientsDir(), baseSlug);
}
