/**
 * lib/search-approvals.js — the operator's decisions on Search Console proposals (L12, Phase 3).
 *
 * The agency's nightly job writes proposals to KV (juneau-digital-designs app/lib/seo-store.ts);
 * the console decides them. A decision does two things:
 *   1. It updates the proposal record in KV, so the job never proposes it again (approved), or not
 *      for 90 days (declined, asked).
 *   2. For an approved spoke, it adds `{town, service}` to the site's approved list, a local file
 *      beside its .env.local. The Studio passes that list to `chosenSpokePages`, which still builds
 *      the spoke only once its facts pass the gate, so approving never publishes anything. An
 *      approved merge-back takes the spoke off the list, and the export then redirects its URL.
 *
 * The key formats below are the agency's; they must stay byte-identical to seo-store.ts.
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export const APPROVED_SPOKES_FILE = 'approved-spokes.json';

export const proposalKey = (acct, slug, id) => `jdd:seo:proposal:v1:${acct}:${slug}:${id}`;
export const proposalIndexKey = (acct, slug) => `jdd:seo:proposal:index:v1:${acct}:${slug}`;

/** Which decisions each kind of proposal takes. */
export const DECISIONS = Object.freeze({
  spoke: ['approved', 'declined'],
  'ask-client': ['asked', 'declined'],
  'town-facts': ['asked', 'declined'],
  fold: ['approved', 'declined'],
});

export function readApprovedSpokes(siteDir) {
  const file = join(siteDir, APPROVED_SPOKES_FILE);
  if (!existsSync(file)) return [];
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(raw)) throw new Error(`${file} is not a list`);
  return raw.filter((s) => s && typeof s.town === 'string' && typeof s.service === 'string').map((s) => ({ town: s.town, service: s.service, approvedAt: s.approvedAt ?? null }));
}

export function writeApprovedSpokes(siteDir, list) {
  const file = join(siteDir, APPROVED_SPOKES_FILE);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(list, null, 2)}\n`);
  renameSync(tmp, file);
}

const sameSpoke = (a, b) => a.town.trim().toLowerCase() === b.town.trim().toLowerCase() && a.service === b.service;

/**
 * Apply one decision. Pure: returns the updated proposal and approved list, or throws when the
 * decision doesn't fit the proposal (a wrong kind, or one already decided).
 */
export function applyDecision({ proposal, decision, approved, now = new Date() }) {
  if (!proposal) throw new Error('No such proposal.');
  if (proposal.status !== 'open') throw new Error(`This proposal was already ${proposal.status}.`);
  const allowed = DECISIONS[proposal.kind] ?? [];
  if (!allowed.includes(decision)) throw new Error(`A ${proposal.kind} proposal can’t be ${decision}.`);

  const decided = { ...proposal, status: decision, decidedAt: now.toISOString() };
  let list = approved;
  if (decision === 'approved' && proposal.kind === 'spoke') {
    const spoke = { town: proposal.town, service: proposal.service };
    if (!approved.some((s) => sameSpoke(s, spoke))) list = [...approved, { ...spoke, approvedAt: decided.decidedAt }];
  } else if (decision === 'approved' && proposal.kind === 'fold') {
    list = approved.filter((s) => !sameSpoke(s, { town: proposal.town, service: proposal.service }));
  }
  return { proposal: decided, approved: list };
}

/**
 * A proposal for a front-to-back TEST run, on a test fixture only. A new property has no Search
 * Console data for months, so the nightly job can't produce one in a test. This is the record the
 * job would write for a spoke, with its evidence marked as a test. Never for a real client: the
 * slug must be a test client (isTestClient).
 */
/**
 * Who a test proposal may be seeded for: an `_e2e_` fixture, or a slug the TEST environment names
 * in SEARCH_SEED_TEST_SLUGS (comma-separated, exact). The production .env never sets it. "e2e"
 * inside a slug is not a marker: free2eat is a plausible real business.
 */
export function isTestClient(slug, env = process.env) {
  const s = String(slug ?? '');
  if (/^_e2e_/.test(s)) return true;
  const named = String(env.SEARCH_SEED_TEST_SLUGS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  return named.includes(s);
}

export function testFixtureProposal({ slug, town, townSlug, service, now = new Date(), env = process.env }) {
  if (!isTestClient(slug, env)) throw new Error(`refusing: ${slug} is not a test client (_e2e_, or named in SEARCH_SEED_TEST_SLUGS)`);
  if (!town || !townSlug || !/^[a-z0-9-]+$/.test(String(service))) throw new Error('need --town and --service (a service slug)');
  return {
    id: `spoke:${townSlug}:${service}`,
    kind: 'spoke',
    town,
    service,
    status: 'open',
    createdAt: now.toISOString(),
    test: true,
    evidence: {
      windowDays: 90,
      impressions: 30,
      clicks: 2,
      queries: [{ query: `(test) ${service.replace(/-/g, ' ')} ${town.toLowerCase()}`, impressions: 30, clicks: 2, position: 8 }],
    },
  };
}
