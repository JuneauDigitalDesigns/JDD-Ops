import 'server-only';
import { resolve } from 'node:path';
import { findOpsRoot } from '@/lib/opsRoot';

// The jdd-ops root (which holds onboard.js, clients/, template/) is found by walking up
// from the console app's cwd via the shared findOpsRoot helper.
export function opsRoot(): string {
  return findOpsRoot();
}

export function clientsDir(): string {
  return resolve(opsRoot(), 'clients');
}

/** Absolute path to a client's base folder (clients/{slug}). */
export function clientDir(baseSlug: string): string {
  return resolve(clientsDir(), baseSlug);
}
