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
  /** Epoch ms Vercel last wrote this var. Comes free with the list call. */
  updatedAt: number | null;
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

/** A DNS record the registrar must add before Vercel will serve the domain. */
export interface DomainVerification {
  type: string;
  domain: string;
  value: string;
  reason: string | null;
}

export interface ProjectDomain {
  name: string;
  apexName: string | null;
  verified: boolean;
  redirect: string | null;
  gitBranch: string | null;
  createdAt: number | null;
  /** Only populated while unverified — Vercel drops the field once the domain passes. */
  verification: DomainVerification[];
}

export interface DomainList {
  ok: boolean;
  projectName: string;
  reason?: string;
  domains: ProjectDomain[];
}

export interface AddDomainResult {
  ok: boolean;
  projectName: string;
  reason?: string;
  domain?: ProjectDomain;
}

export interface VerifyDomainResult {
  ok: boolean;
  projectName: string;
  verified: boolean;
  reason?: string;
  domain?: ProjectDomain;
}

/** Where a domain's DNS actually points right now. Account-level — works unattached. */
export interface DomainConfig {
  ok: boolean;
  domain: string;
  reason?: string;
  /** null = not pointed at Vercel. 'A' | 'CNAME' | 'http' = it is. */
  configuredBy: string | null;
  misconfigured: boolean;
  nameservers: string[];
  aValues: string[];
  cnames: string[];
  conflicts: unknown[];
  acceptedChallenges: string[];
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
  /** Attaches but does not verify; a 409 comes back as { ok:false, reason }. */
  addProjectDomain(slug: string, domain: string): Promise<AddDomainResult>;
  /** Re-checks a pending domain after the operator updates DNS. */
  verifyProjectDomain(slug: string, domain: string): Promise<VerifyDomainResult>;
  /** Takes a bare domain, not a slug — the endpoint is account-level. */
  getDomainConfig(domain: string): Promise<DomainConfig>;
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
