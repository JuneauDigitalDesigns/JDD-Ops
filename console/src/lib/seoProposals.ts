import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Redis } from '@upstash/redis';
import { opsRoot } from './paths';
import { loadKvCredentials } from './opsSecrets';

/**
 * The console's side of Phase 3: read the nightly job's proposals for a site, and decide them.
 * Rules live in jdd-ops/lib/search-approvals.js; the proposals themselves in the agency's KV,
 * written by juneau-digital-designs app/lib/search-console-job.ts.
 */

export type ProposalKind = 'spoke' | 'ask-client' | 'town-facts' | 'fold';
export type Decision = 'approved' | 'declined' | 'asked';

export interface SeoProposal {
  id: string;
  kind: ProposalKind;
  town: string;
  service?: string;
  status: 'open' | Decision;
  createdAt: string;
  decidedAt?: string;
  missing?: Array<'shared-facts' | 'service-page'>;
  evidence: {
    windowDays: number;
    impressions: number;
    clicks: number;
    queries: Array<{ query: string; impressions: number; clicks: number; position: number }>;
    signal?: { calls: number; leads: number };
  };
}

export interface ApprovedSpoke {
  town: string;
  service: string;
  approvedAt: string | null;
}

interface ApprovalsModule {
  proposalKey(acct: string, slug: string, id: string): string;
  proposalIndexKey(acct: string, slug: string): string;
  readApprovedSpokes(siteDir: string): ApprovedSpoke[];
  writeApprovedSpokes(siteDir: string, list: ApprovedSpoke[]): void;
  applyDecision(args: { proposal: SeoProposal | null; decision: Decision; approved: ApprovedSpoke[] }): {
    proposal: SeoProposal;
    approved: ApprovedSpoke[];
  };
}
interface AccountStoreModule {
  accountScope(email: string): string;
}

const cache = new Map<string, Promise<unknown>>();
function loadOps<T>(file: string): Promise<T> {
  const path = resolve(opsRoot(), 'lib', file);
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;
  let mod = cache.get(url);
  if (!mod) {
    mod = import(/* webpackIgnore: true */ url);
    cache.set(url, mod);
  }
  return mod as Promise<T>;
}

let _redis: Redis | null = null;
function redis(): Redis {
  if (!loadKvCredentials()) throw new Error('KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env.');
  if (!_redis) {
    _redis = new Redis({
      url: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) as string,
      token: (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN) as string,
    });
  }
  return _redis;
}

async function scopeOf(accountEmail: string): Promise<string> {
  return (await loadOps<AccountStoreModule>('account-store.js')).accountScope(accountEmail);
}

/** Every proposal for the site, open ones first, newest first within each group. */
export async function listSiteProposals(accountEmail: string, siteSlug: string): Promise<SeoProposal[]> {
  const lib = await loadOps<ApprovalsModule>('search-approvals.js');
  const acct = await scopeOf(accountEmail);
  const ids = await redis().zrange<string[]>(lib.proposalIndexKey(acct, siteSlug), 0, -1);
  if (!ids.length) return [];
  const got = await redis().mget<(SeoProposal | null)[]>(...ids.map((id) => lib.proposalKey(acct, siteSlug, id)));
  return got
    .filter((p): p is SeoProposal => Boolean(p))
    .sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.createdAt.localeCompare(a.createdAt));
}

export async function readApproved(siteDir: string): Promise<ApprovedSpoke[]> {
  return (await loadOps<ApprovalsModule>('search-approvals.js')).readApprovedSpokes(siteDir);
}

/**
 * Decide one proposal. The approved list is written before KV, so a KV failure leaves the
 * proposal open to be decided again (an approved spoke is never listed twice), never a closed
 * proposal whose spoke went missing.
 */
export async function decideProposal(args: {
  accountEmail: string;
  siteSlug: string;
  siteDir: string;
  id: string;
  decision: Decision;
}): Promise<{ proposal: SeoProposal; approved: ApprovedSpoke[] }> {
  const lib = await loadOps<ApprovalsModule>('search-approvals.js');
  const acct = await scopeOf(args.accountEmail);
  const key = lib.proposalKey(acct, args.siteSlug, args.id);
  const current = (await redis().get<SeoProposal>(key)) ?? null;
  const out = lib.applyDecision({ proposal: current, decision: args.decision, approved: lib.readApprovedSpokes(args.siteDir) });
  lib.writeApprovedSpokes(args.siteDir, out.approved);
  await redis().set(key, out.proposal);
  return out;
}
