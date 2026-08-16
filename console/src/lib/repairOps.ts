import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from './paths';

/**
 * Bridge to jdd-ops/lib/repair-ops.js — the write half of reconcile.
 *
 * Same `webpackIgnore` + mtime-keyed dynamic import as vercelSync.ts and reconcileProbes.ts.
 * Callers load credentials themselves and pass them in; the module reads no environment.
 */

export interface RepairResult<B = unknown, A = unknown> {
  ok: boolean;
  before?: B;
  after?: A;
  reason: string | null;
  /** The value was already what we were asked to set. Nothing changed, nothing to undo. */
  noop?: boolean;
}

export interface RepairOpsModule {
  setTwilioWebhook(args: {
    accountSid: string | null;
    authToken: string | null;
    phoneNumber: string | null | undefined;
    field: 'voiceUrl' | 'smsUrl';
    url: string;
  }): Promise<RepairResult<string | null, string | null>>;

  setRetellAgentConfig(args: {
    apiKey: string | null;
    agentId: string | null | undefined;
    patch: Record<string, unknown>;
  }): Promise<RepairResult<Record<string, unknown>, Record<string, unknown>>>;

  setMakeScenarioState(args: {
    apiKey: string | null;
    zone: string;
    scenarioId: number | string;
    active: boolean;
  }): Promise<RepairResult<boolean, boolean>>;

  /** Additive only — creates an absent table or field, never modifies an existing one. */
  repairAirtableBase(args: {
    apiKey: string | null;
    baseId: string | null | undefined;
    want: 'call-log' | 'site-column';
    siteTag?: string | null;
  }): Promise<RepairResult<string, string>>;
}

const cache = new Map<string, Promise<RepairOpsModule>>();

export function loadRepairOps(): Promise<RepairOpsModule> {
  const path = resolve(opsRoot(), 'lib', 'repair-ops.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;

  let mod = cache.get(url);
  if (!mod) {
    cache.clear();
    mod = import(/* webpackIgnore: true */ url) as Promise<RepairOpsModule>;
    cache.set(url, mod);
  }
  return mod;
}
