import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from './paths';
import type { AiStatementDiff } from './aiStatementTypes';

/**
 * Bridge to jdd-ops/lib/ai-statement.js: the same `webpackIgnore`'d import as reconcileProbes.ts,
 * with the mtime in the URL so an edit takes effect without a restart. One implementation for the
 * console, the CLI scripts and onboard.js, so what the Voice agent tab adds is what they keep.
 */

export type AiStatementLiveState = 'absent' | 'intact' | 'altered';

interface Refusal {
  ok: false;
  reason: string;
  masterBound?: boolean;
  conflict?: boolean;
  unverified?: boolean;
}

export interface AiStatementPreview {
  ok: true;
  agentId: string;
  llmId: string;
  enabled: boolean;
  live: AiStatementLiveState;
  drift: boolean;
  sentence: string | null;
  proposal: {
    enabled: boolean;
    changed: boolean;
    hash: string;
    charsBefore: number;
    charsAfter: number;
    diff: AiStatementDiff;
  } | null;
}

export interface AiStatementApplied {
  ok: true;
  enabled: boolean;
  changed: boolean;
  agentId: string;
  llmId: string;
  charsBefore: number;
  charsAfter: number;
  liveInSyncWithDisk: boolean | null;
  disk: { changed: boolean; content: string | null; error: string | null };
}

interface LiveArgs {
  apiKey: string | null;
  agentId: string | undefined;
  masterLlmId: string | null;
  dir: string;
  fallbackBusiness: string;
}

export interface AiStatementModule {
  previewAiStatement(args: LiveArgs & { want?: boolean | null }): Promise<AiStatementPreview | Refusal>;
  applyAiStatement(args: LiveArgs & { enabled: boolean; expectedHash: string }): Promise<AiStatementApplied | Refusal>;
  applyStoredAiStatement(prompt: string, dir: string): {
    prompt: string;
    change: 'added' | 'repaired' | 'removed' | null;
    setting: { enabled: boolean };
  };
}

const cache = new Map<string, Promise<AiStatementModule>>();

export function loadAiStatement(): Promise<AiStatementModule> {
  const path = resolve(opsRoot(), 'lib', 'ai-statement.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;

  let mod = cache.get(url);
  if (!mod) {
    cache.clear();
    mod = import(/* webpackIgnore: true */ url) as Promise<AiStatementModule>;
    cache.set(url, mod);
  }
  return mod;
}
