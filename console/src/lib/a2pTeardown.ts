import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from './paths';
import { loadKvCredentials, loadTeardownCredentials } from './opsSecrets';
import type { StepResult } from './teardownOps';

/**
 * Bridge to lib/a2p-teardown.js — the A2P half of /manage → Danger. Its own bridge rather than
 * lines in teardownOps.ts so the shared teardown files only gain a call each (another branch is
 * editing them). Same webpackIgnore'd, mtime-keyed import as the other bridges.
 */

export interface A2pTeardownPlan {
  hasRecord: boolean;
  state: 'live' | 'never-completed' | 'unknown' | 'none';
  detail: string;
  toDelete: Array<{ kind: string; sid: string; exists: boolean | null; status?: string }>;
  kept: Array<{ kind: string; sid: string; reason: string }>;
  messagingServiceSid: string | null;
}

interface A2pTeardownModule {
  planA2pTeardown(args: Creds & { slug: string }): Promise<{ ok: true; plan: A2pTeardownPlan } | { ok: false; error: string }>;
  teardownA2pRegistration(args: Creds & { slug: string; dryRun?: boolean }): Promise<{ steps: StepResult[]; plan: A2pTeardownPlan | null }>;
  detachA2pNumber(args: Creds & { slug: string; phoneNumber: string | undefined; dryRun?: boolean }): Promise<StepResult>;
}

interface Creds {
  accountSid: string | undefined;
  authToken: string | undefined;
  kvUrl: string | undefined;
  kvToken: string | undefined;
}

const cache = new Map<string, Promise<A2pTeardownModule>>();

export function loadA2pTeardown(): Promise<A2pTeardownModule> {
  const path = resolve(opsRoot(), 'lib', 'a2p-teardown.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;
  let mod = cache.get(url);
  if (!mod) {
    cache.clear();
    mod = import(/* webpackIgnore: true */ url) as Promise<A2pTeardownModule>;
    cache.set(url, mod);
  }
  return mod;
}

/** Twilio + KV credentials, the way every teardown op takes them: as arguments. */
export function a2pTeardownCreds(): Creds {
  loadKvCredentials();
  const { twilioAccountSid, twilioAuthToken } = loadTeardownCredentials();
  return {
    accountSid: twilioAccountSid ?? undefined,
    authToken: twilioAuthToken ?? undefined,
    kvUrl: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    kvToken: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  };
}

/**
 * The preview's A2P block. Read-only. NOT part of the preview hash: statuses move while a
 * registration is in review, and a teardown must not abort because a carrier advanced a brand
 * between preview and confirm. The destroy step re-plans live anyway, so a registration that
 * went live in that window is kept rather than deleted.
 */
export async function planA2pForTeardown(slug: string): Promise<{ plan: A2pTeardownPlan | null; error: string | null }> {
  const mod = await loadA2pTeardown();
  const out = await mod.planA2pTeardown({ slug, ...a2pTeardownCreds() });
  return out.ok ? { plan: out.plan, error: null } : { plan: null, error: out.error };
}
