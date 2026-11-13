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
