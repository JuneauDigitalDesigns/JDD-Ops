import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from './paths';

/**
 * Bridge to jdd-ops/lib/teardown-ops.js — the per-resource deletes that both the console's
 * Danger section and scripts/teardown.js run. Same webpackIgnore'd, mtime-keyed dynamic
 * import as vercelSync.ts, for the same reason: teardown-ops.js lives outside the console
 * app's root and must never be bundled, and Next's HMR doesn't reach out there to notice
 * an edit without the mtime key forcing a reload.
 *
 * teardown-ops.js resolves @clerk/backend from jdd-ops's own node_modules (already a
 * dependency there, for onboard.js's test-login step), so the console never needs that
 * package as its own dependency — one fewer thing to keep in sync between two package.jsons.
 */

export type Outcome = 'deleted' | 'already-gone' | 'skipped' | 'failed';

export interface StepResult {
  resource: string;
  target: string;
  outcome: Outcome;
  httpStatus?: number;
  message?: string;
  durationMs: number;
}

export interface EnvSite {
  slug: string;
  dir: string;
  env: Record<string, string>;
}

export interface ClerkCandidate {
  userId: string;
  resolvedBy: 'env' | 'email';
}

export interface MakeScenarioCandidate {
  id: string;
  resolvedBy: 'env' | 'name' | 'webhook';
}

interface TeardownOpsModule {
  discoverSites(clientDir: string, baseSlug: string): EnvSite[];
  parseEnvLocal(envPath: string): Record<string, string>;

  deleteGitHubRepo(args: { octokit: unknown; org: string | undefined; repo: string }): Promise<StepResult>;
  releaseTwilioNumber(args: { client: unknown; phoneNumber: string | undefined }): Promise<StepResult>;
  deleteRetellAgent(args: { apiKey: string | undefined; agentId: string | undefined }): Promise<StepResult>;
  deleteRetellLlm(args: { apiKey: string | undefined; llmId: string | null | undefined }): Promise<StepResult>;
  deleteVercelProject(args: { token: string | undefined; teamId: string | undefined; slug: string }): Promise<StepResult>;
  deleteAirtableBase(args: { apiKey: string | undefined; baseId: string | undefined }): Promise<StepResult>;
  stopAndDeleteMakeScenario(args: { apiKey: string | undefined; zone: string; scenarioId: string | null | undefined }): Promise<StepResult>;

  resolveRetellLlmId(args: { apiKey: string | undefined; agentId: string | undefined }): Promise<string | null>;
  resolveMakeScenarioId(args: {
    apiKey: string | undefined;
    zone: string;
    envScenarioId: string | undefined;
    brandName: string | undefined;
    webhookUrl: string | undefined;
  }): Promise<MakeScenarioCandidate | null>;
  resolveClerkUser(args: {
    secretKey: string | undefined;
    envUserId: string | undefined;
    email: string | null;
  }): Promise<ClerkCandidate | null>;
  deleteClerkUser(args: { secretKey: string | undefined; userId: string | undefined }): Promise<StepResult>;

  probeVercelProject(args: { token: string | undefined; teamId: string | undefined; slug: string }): Promise<boolean | null>;
  probeGitHubRepo(args: { octokit: unknown; org: string | undefined; repo: string }): Promise<boolean | null>;
  probeRetellAgent(args: { apiKey: string | undefined; agentId: string | undefined }): Promise<boolean | null>;
  probeTwilioNumber(args: { client: unknown; phoneNumber: string | undefined }): Promise<boolean | null>;
  probeAirtableBase(args: { apiKey: string | undefined; baseId: string | undefined }): Promise<{ exists: boolean | null; name: string | null }>;
}

const cache = new Map<string, Promise<TeardownOpsModule>>();

export function loadTeardownOps(): Promise<TeardownOpsModule> {
  const path = resolve(opsRoot(), 'lib', 'teardown-ops.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;

  let mod = cache.get(url);
  if (!mod) {
    cache.clear();
    mod = import(/* webpackIgnore: true */ url) as Promise<TeardownOpsModule>;
    cache.set(url, mod);
  }
  return mod;
}
