import 'server-only';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ClientState, ClientStatus, RunbookState } from './types';

// Durable per-client progress lives in runbook/.state/progress.json (gitignored). Survives
// browser clears and machine switches — the dashboard reads it alongside the disk-derived
// detectedStatus. process.cwd() is the runbook app dir.
const STATE_DIR = resolve(process.cwd(), '.state');
const STATE_FILE = resolve(STATE_DIR, 'progress.json');

export function readState(): RunbookState {
  try {
    if (!existsSync(STATE_FILE)) return {};
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as RunbookState;
  } catch {
    return {};
  }
}

function writeState(state: RunbookState): void {
  mkdirSync(STATE_DIR, { recursive: true });
  // Atomic write: write a temp file then rename, so a crash can't truncate progress.json.
  const tmp = resolve(STATE_DIR, `progress.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, STATE_FILE);
}

export interface PatchInput {
  slug: string;
  status?: ClientStatus;
  step?: { id: string; done: boolean };
}

/** Merge an update for one client and persist. Returns that client's new state. */
export function patchClientState({ slug, status, step }: PatchInput): ClientState {
  const state = readState();
  const prev: ClientState = state[slug] ?? { steps: {} };
  const next: ClientState = { ...prev, steps: { ...prev.steps } };

  if (status !== undefined) next.status = status;
  if (step) {
    if (step.done) next.steps[step.id] = true;
    else delete next.steps[step.id];
  }
  next.updatedAt = new Date().toISOString();

  state[slug] = next;
  writeState(state);
  return next;
}
