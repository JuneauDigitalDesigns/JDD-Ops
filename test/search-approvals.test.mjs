// lib/search-approvals.js: deciding the nightly job's proposals (L12, Phase 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyDecision, readApprovedSpokes, writeApprovedSpokes, proposalKey, proposalIndexKey } from '../lib/search-approvals.js';

const open = (over = {}) => ({ id: 'spoke:minneola:ac-repair', kind: 'spoke', town: 'Minneola', service: 'ac-repair', status: 'open', createdAt: '2026-11-13T00:00:00.000Z', evidence: {}, ...over });
const NOW = new Date('2026-11-14T00:00:00Z');

test('key formats are the agency job\'s, byte for byte (juneau-digital-designs app/lib/seo-store.ts)', () => {
  assert.equal(proposalKey('a1', 'acme', 'spoke:minneola:ac-repair'), 'jdd:seo:proposal:v1:a1:acme:spoke:minneola:ac-repair');
  assert.equal(proposalIndexKey('a1', 'acme'), 'jdd:seo:proposal:index:v1:a1:acme');
});

test('approving a spoke adds it once to the approved list and closes the proposal', () => {
  const out = applyDecision({ proposal: open(), decision: 'approved', approved: [], now: NOW });
  assert.equal(out.proposal.status, 'approved');
  assert.equal(out.proposal.decidedAt, NOW.toISOString());
  assert.deepEqual(out.approved, [{ town: 'Minneola', service: 'ac-repair', approvedAt: NOW.toISOString() }]);
  const again = applyDecision({ proposal: open(), decision: 'approved', approved: out.approved, now: NOW });
  assert.equal(again.approved.length, 1);
});

test('approving a merge-back takes the spoke off the list', () => {
  const approved = [{ town: 'minneola', service: 'ac-repair', approvedAt: null }, { town: 'Minneola', service: 'duct-cleaning', approvedAt: null }];
  const out = applyDecision({ proposal: open({ id: 'fold:minneola:ac-repair', kind: 'fold' }), decision: 'approved', approved, now: NOW });
  assert.deepEqual(out.approved.map((s) => s.service), ['duct-cleaning']);
});

test('declining or asking never touches the approved list; wrong decisions and repeats are refused', () => {
  assert.deepEqual(applyDecision({ proposal: open(), decision: 'declined', approved: [], now: NOW }).approved, []);
  assert.equal(applyDecision({ proposal: open({ kind: 'ask-client' }), decision: 'asked', approved: [], now: NOW }).proposal.status, 'asked');
  assert.throws(() => applyDecision({ proposal: open({ kind: 'ask-client' }), decision: 'approved', approved: [] }), /can’t be approved/);
  assert.throws(() => applyDecision({ proposal: open({ status: 'declined' }), decision: 'approved', approved: [] }), /already declined/);
  assert.throws(() => applyDecision({ proposal: null, decision: 'approved', approved: [] }), /No such proposal/);
});

test('the approved list round-trips through its file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'appr-'));
  try {
    assert.deepEqual(readApprovedSpokes(dir), []);
    writeApprovedSpokes(dir, [{ town: 'Minneola', service: 'ac-repair', approvedAt: 'x' }]);
    assert.deepEqual(readApprovedSpokes(dir), [{ town: 'Minneola', service: 'ac-repair', approvedAt: 'x' }]);
    assert.ok(readFileSync(join(dir, 'approved-spokes.json'), 'utf8').endsWith('\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { testFixtureProposal, isTestClient } from '../lib/search-approvals.js';

test('a seeded test proposal is for e2e test clients only, and is marked as a test', () => {
  assert.throws(() => testFixtureProposal({ slug: 'acme-air', town: 'Minneola', townSlug: 'minneola', service: 'ac-repair', env: {} }), /not a test client/);
  assert.equal(testFixtureProposal({ slug: 'copperline-e2e2', town: 'Minneola', townSlug: 'minneola', service: 'ac-repair', now: NOW, env: { SEARCH_SEED_TEST_SLUGS: 'copperline-e2e2' } }).id, 'spoke:minneola:ac-repair');
  const p = testFixtureProposal({ slug: '_e2e_test_starter', town: 'Minneola', townSlug: 'minneola', service: 'ac-repair', now: NOW });
  assert.equal(p.id, 'spoke:minneola:ac-repair');
  assert.equal(p.test, true);
  assert.match(p.evidence.queries[0].query, /^\(test\) /);
  // It is a proposal the real decide path accepts.
  assert.equal(applyDecision({ proposal: p, decision: 'approved', approved: [], now: NOW }).approved.length, 1);
});

test('the seed guard: _e2e_ fixtures, or a slug the test environment names; never a real client by accident', () => {
  // "e2e" inside a word is not a test marker: free2eat is a plausible real business.
  assert.equal(isTestClient('free2eat', {}), false);
  assert.equal(isTestClient('copperline-e2e2', {}), false, 'not without the test environment naming it');
  assert.equal(isTestClient('copperline-e2e2', { SEARCH_SEED_TEST_SLUGS: 'copperline-e2e2' }), true);
  assert.equal(isTestClient('copperline-e2e', { SEARCH_SEED_TEST_SLUGS: 'copperline-e2e2' }), false, 'exact names only');
  assert.equal(isTestClient('_e2e_test_starter', {}), true);
  assert.throws(() => testFixtureProposal({ slug: 'free2eat', town: 'Minneola', townSlug: 'minneola', service: 'ac-repair', env: {} }), /not a test client/);
});
