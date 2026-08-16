import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from './paths';

/**
 * Bridge to jdd-ops/lib/reconcile-probes.js.
 *
 * Same mechanism as vercelSync.ts: a `webpackIgnore`'d dynamic import so Next never tries
 * to bundle a file from outside the console app's root, with the mtime in the URL because
 * Node's ESM cache is keyed by URL and never invalidates — without it, an edit to the
 * probes wouldn't take effect until the dev server restarted.
 *
 * The probes read no environment of their own: every credential is passed in by the
 * caller, which is what lets the console own credential loading in one place
 * (opsSecrets.ts) rather than having two modules disagree about where `.env` lives.
 */

export interface TwilioNumberProbe {
  exists: boolean | null;
  voiceUrl: string | null;
  smsUrl: string | null;
  voiceUrlMatches: boolean | null;
  expected: string | null;
  recentSendErrors: { total: number; failed: number; codes: number[] } | null;
  checked: boolean;
}

export interface RetellAgentProbe {
  exists: boolean | null;
  llmId: string | null;
  webhookUrl: string | null;
  webhookMatches: boolean | null;
  promptMatches: boolean | null;
  livePrompt: string | null;
  maxCallDurationMs: number | null;
  checked: boolean;
}

export interface MakeScenarioProbe {
  scenarioId: number | string | null;
  isActive: boolean | null;
  name: string | null;
  checked: boolean;
}

export interface AirtableBaseProbe {
  exists: boolean | null;
  hasCallLog: boolean | null;
  hasSiteColumn: boolean | null;
  needsSiteColumn: boolean;
  checked: boolean;
}

export interface DomainExpiryProbe {
  expiresAt: number | null;
  renewalDisabled: boolean | null;
  checked: boolean;
}

export interface ReconcileProbesModule {
  voiceUrlForHost(host: string): string;
  probeTwilioNumber(args: {
    accountSid: string | null;
    authToken: string | null;
    phoneNumber: string | null | undefined;
    /** Host Vercel actually serves, e.g. `acme.vercel.app`. Null ⇒ comparison is unknown. */
    liveHost: string | null;
  }): Promise<TwilioNumberProbe>;
  probeRetellAgent(args: {
    apiKey: string | null;
    agentId: string | null | undefined;
    promptOnDisk: string | null;
    expectedWebhookUrl: string | null;
  }): Promise<RetellAgentProbe>;
  probeMakeScenario(args: {
    apiKey: string | null;
    zone: string;
    webhookUrl: string | null | undefined;
  }): Promise<MakeScenarioProbe>;
  probeAirtableBase(args: {
    apiKey: string | null;
    baseId: string | null | undefined;
    needsSiteColumn?: boolean;
  }): Promise<AirtableBaseProbe>;
  probeDomainExpiry(args: {
    token: string | null;
    teamId: string | null;
    domain: string;
  }): Promise<DomainExpiryProbe>;
}

const cache = new Map<string, Promise<ReconcileProbesModule>>();

export function loadReconcileProbes(): Promise<ReconcileProbesModule> {
  const path = resolve(opsRoot(), 'lib', 'reconcile-probes.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;

  let mod = cache.get(url);
  if (!mod) {
    cache.clear(); // drop the stale revision; only the current one is useful
    mod = import(/* webpackIgnore: true */ url) as Promise<ReconcileProbesModule>;
    cache.set(url, mod);
  }
  return mod;
}
