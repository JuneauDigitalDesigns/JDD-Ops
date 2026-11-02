/**
 * The lead-ingest seam between ops and the agency site.
 *
 * Two values cross a repo boundary here, and neither repo can import the other — so both exist
 * as deliberate copies, and this file is what stops them drifting:
 *
 *   1. `accountScope(email)` — ops writes the token record under this scope, the portal reads
 *      under it. A mismatch does NOT error. It writes a perfectly valid record to a key nobody
 *      looks at, and every lead 401s with nothing wrong on either side. This is the same failure
 *      shape as the seven provisioning bugs the suite exists for: the credential looks
 *      configured, the endpoint looks healthy, and leads are simply gone.
 *
 *   2. The token format — minted by `lib/client-env.js#newIngestToken`, validated on write by
 *      `checkEnvTierMatrix`, and length-checked on read by the portal's `resolveIngestToken`.
 *
 * The portal's copies live at:
 *   juneau-digital-designs/app/lib/portal-kv.ts:82     accountScope
 *   juneau-digital-designs/app/lib/portal-leads.ts     newIngestToken / resolveIngestToken
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { accountScope } from '../lib/account-store.js';
import { newIngestToken } from '../lib/client-env.js';
import { checkEnvTierMatrix } from '../lib/onboard-checks.js';

/** The portal's algorithm, written out independently rather than imported from the same place. */
const portalAccountScope = (email) =>
  createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);

test('accountScope matches the portal byte-for-byte', () => {
  // Cases chosen for the normalisation steps, because that is where a reimplementation drifts:
  // casing, surrounding whitespace, and the 16-char truncation.
  for (const email of [
    'owner@example.com',
    'Owner@Example.COM',
    '  owner@example.com  ',
    'o+tag@sub.example.co.uk',
    'ALLCAPS@EXAMPLE.COM',
  ]) {
    assert.equal(accountScope(email), portalAccountScope(email), email);
  }
});

test('accountScope normalises case and whitespace to one scope', () => {
  // A client whose email differs only by casing between the intake and the portal must still
  // resolve to the same namespace, or their leads land somewhere they cannot read.
  const base = accountScope('owner@example.com');
  assert.equal(accountScope('OWNER@EXAMPLE.COM'), base);
  assert.equal(accountScope(' owner@example.com '), base);
});

test('accountScope is 16 lowercase hex chars', () => {
  // Pinned because the truncation length is arbitrary-looking and therefore easy to "tidy".
  assert.match(accountScope('owner@example.com'), /^[0-9a-f]{16}$/);
});

test('different emails get different scopes', () => {
  assert.notEqual(accountScope('a@example.com'), accountScope('b@example.com'));
});

test('a minted token is 64 lowercase hex chars', () => {
  // The portal rejects anything under 32 chars outright; checkEnvTierMatrix requires exactly 64.
  for (let i = 0; i < 25; i++) {
    assert.match(newIngestToken(), /^[0-9a-f]{64}$/);
  }
});

test('minted tokens are unique', () => {
  // A constant or seeded generator would let any client site post leads into any other account.
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(newIngestToken());
  assert.equal(seen.size, 200);
});

test('checkEnvTierMatrix accepts a freshly minted token and rejects near-misses', () => {
  const lines = (token) => [
    'LEAD_DELIVERY_MODE=portal',
    'LEAD_CALLBACK=off',
    `LEAD_INGEST_TOKEN=${token}`,
    'LEAD_INGEST_URL=https://juneaudigitaldesigns.com/api/ingest/lead',
  ];
  const run = (token) => checkEnvTierMatrix({ lines: lines(token), plan: 'starter', webOnly: true });

  assert.equal(run(newIngestToken()).ok, true, 'a real token must pass');

  // Each of these is a plausible hand-edit that would 401 every lead in production.
  assert.equal(run('').ok, false, 'empty');
  assert.equal(run('a'.repeat(63)).ok, false, 'one char short');
  assert.equal(run('a'.repeat(65)).ok, false, 'one char long');
  assert.equal(run('A'.repeat(64)).ok, false, 'uppercase hex');
  assert.equal(run(`${'a'.repeat(60)}-abc`).ok, false, 'hyphenated UUID left unstripped');
});

test('checkEnvTierMatrix rejects a Resend leftover', () => {
  // A surviving Resend key means an older env template is still in play, which also means the
  // repo got the email version of /api/contact.
  const res = checkEnvTierMatrix({
    lines: [
      'LEAD_DELIVERY_MODE=portal',
      'LEAD_CALLBACK=off',
      `LEAD_INGEST_TOKEN=${newIngestToken()}`,
      'LEAD_INGEST_URL=https://juneaudigitaldesigns.com/api/ingest/lead',
      'RESEND_API_KEY=re_live_123',
    ],
    plan: 'starter',
    webOnly: true,
  });
  assert.equal(res.ok, false);
  assert.match(res.detail, /RESEND_API_KEY/);
});

test('checkEnvTierMatrix rejects an http or wrong-path ingest URL', () => {
  const build = (url) =>
    checkEnvTierMatrix({
      lines: [
        'LEAD_DELIVERY_MODE=portal',
        'LEAD_CALLBACK=off',
        `LEAD_INGEST_TOKEN=${newIngestToken()}`,
        `LEAD_INGEST_URL=${url}`,
      ],
      plan: 'starter',
      webOnly: true,
    });
  assert.equal(build('http://juneaudigitaldesigns.com/api/ingest/lead').ok, false, 'plaintext');
  assert.equal(build('https://juneaudigitaldesigns.com/api/contact').ok, false, 'wrong path');
  assert.equal(build('https://preview-abc.vercel.app/api/ingest/lead').ok, true, 'preview host is fine');
});
