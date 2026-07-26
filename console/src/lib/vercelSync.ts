import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from './paths';

/**
 * Bridge to jdd-ops/lib/vercel-sync.js — the one Vercel API implementation, shared with
 * onboard.js step 9 and `npm run sync-env`. Loaded at runtime via a webpackIgnore'd
 * dynamic import (same trick intake.ts uses for client schemas) so Next never tries to
 * bundle a file from outside the console app's root.
 *
 * Callers must run loadVercelCredentials() first — the module reads process.env.VERCEL_TOKEN
 * at call time, and the console doesn't otherwise load jdd-ops/.env.
 */

export interface SyncResult {
  created: string[];
  updated: string[];
  skipped: string[];
  warnings: string[];
}

export interface ProjectEnvVar {
  id: string | null;
  value: string | null;
  decrypted: boolean;
  target: string[];
}

export interface ProjectEnv {
  ok: boolean;
  projectName: string;
  reason?: string;
  vars: Record<string, ProjectEnvVar>;
}

export interface Deployment {
  id: string;
  url: string | null;
  inspectorUrl: string | null;
  source: 'redeploy' | 'git';
}

/** One entry from the deployment history — distinct from the Deployment a redeploy returns. */
export interface DeploymentRecord {
  id: string;
  url: string | null;
  inspectorUrl: string | null;
  /** READY | ERROR | BUILDING | QUEUED | CANCELED | INITIALIZING | UNKNOWN */
  state: string;
  target: string | null;
  createdAt: number | null;
  readyAt: number | null;
  commitSha: string | null;
  commitMessage: string | null;
  creator: string | null;
}

export interface DeploymentList {
  ok: boolean;
  projectName: string;
  reason?: string;
  deployments: DeploymentRecord[];
}

export interface ProjectDomain {
  name: string;
  apexName: string | null;
  verified: boolean;
  redirect: string | null;
  gitBranch: string | null;
  createdAt: number | null;
}

export interface DomainList {
  ok: boolean;
  projectName: string;
  reason?: string;
  domains: ProjectDomain[];
}

interface VercelSyncModule {
  sanitizeProjectName(slug: string): string;
  /** Exported by the module but previously undeclared here. */
  getVercelProjectId(slug: string): Promise<string | null>;
  syncEnvToVercel(opts: {
    slug: string;
    extraEnv?: Record<string, string>;
    clientDir?: string;
    log?: (line: string) => void;
  }): Promise<SyncResult>;
  listProjectEnv(slug: string, opts?: { resolveKeys?: string[] }): Promise<ProjectEnv>;
  /** Never throws — degrades to { ok: false, reason }. */
  listDeployments(
    slug: string,
    opts?: { limit?: number; target?: string | null },
  ): Promise<DeploymentList>;
  /** Never throws — degrades to { ok: false, reason }. */
  listProjectDomains(slug: string): Promise<DomainList>;
  /** Throws, unlike the list* functions. */
  triggerRedeploy(opts: { slug: string; log?: (line: string) => void }): Promise<Deployment>;
}

const cache = new Map<string, Promise<VercelSyncModule>>();

/**
 * Node's ESM cache is keyed by URL and never invalidates, so an edit to vercel-sync.js
 * would keep serving the version loaded at first import — Next's HMR doesn't reach
 * outside the app. Keying on mtime makes the module reload when the file changes, which
 * is what you expect from a dev server.
 */
export function loadVercelSync(): Promise<VercelSyncModule> {
  const path = resolve(opsRoot(), 'lib', 'vercel-sync.js');
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;

  let mod = cache.get(url);
  if (!mod) {
    cache.clear(); // drop the stale revision; only the current one is useful
    mod = import(/* webpackIgnore: true */ url) as Promise<VercelSyncModule>;
    cache.set(url, mod);
  }
  return mod;
}
