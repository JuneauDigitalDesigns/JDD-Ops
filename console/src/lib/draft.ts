import 'server-only';
import { existsSync, readFileSync, writeFileSync, unlinkSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { clientDir } from '@/lib/paths';

function draftPath(slug: string): string {
  return resolve(clientDir(slug), '.draft.json');
}

export function readDraft(slug: string): Record<string, unknown> | null {
  try {
    const p = draftPath(slug);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function writeDraft(slug: string, bundle: unknown): void {
  const dir = clientDir(slug);
  if (!existsSync(dir)) return;
  // Atomic write: tmp then rename, so a crash can't leave a truncated draft.
  const p = draftPath(slug);
  const tmp = resolve(dir, `.draft.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(bundle), 'utf8');
  renameSync(tmp, p);
}

export function deleteDraft(slug: string): void {
  try {
    unlinkSync(draftPath(slug));
  } catch {
    // already gone or never written
  }
}
