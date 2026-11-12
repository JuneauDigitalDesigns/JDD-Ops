/**
 * Tearing down a site must purge its portal data from KV — and ONLY its portal data.
 *
 * Before this, teardown left every lead and CRM record behind: names, phone numbers, message
 * threads, sitting in KV indefinitely with nothing left to find them by, and the site's ingest
 * token still a live credential pointing at a dead client.
 *
 * The purge is the dangerous direction, so most of these tests are about what must SURVIVE:
 *
 *   - A sibling site whose slug merely starts with this one. Every lead/CRM key is scoped
 *     `…:{acctScope}:{slug}`, and `acme` / `acme-2` under one owner is ordinary for an
 *     enterprise client. A purge globbing `…:{acct}:{slug}*` deletes the sibling's leads too.
 *   - The account's own records. One portal account can hold several sites — both e2e
 *     fixtures share one — so `portal:review:sent:v1:{acct}:…` and `owner-email` belong to the
 *     account, not to the site being removed.
 *   - The same slug under a different account.
 *
 * The KV double reproduces the RECORDED Upstash shapes in `fixtures/kv/upstash-shapes.json`:
 * SCAN as `[cursor-string, keys[]]`, and a token record that comes back as a JSON *string*,
 * not an object. Both were read off the production KV rather than assumed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { purgePortalSiteData, isSiteScopedKey } from '../lib/teardown-ops.js';
import { accountScope } from '../lib/account-store.js';

const SHAPES = JSON.parse(readFileSync(new URL('./fixtures/kv/upstash-shapes.json', import.meta.url), 'utf8'));

const OWNER = 'owner@example.com';
const ACCT = accountScope(OWNER);
const OTHER_OWNER = 'someone-else@example.com';
const OTHER = accountScope(OTHER_OWNER);
const TOKEN = 'lit_test000000000000000000000000000000000';

/**
 * The site being torn down: every site-scoped key family the agency writes.
 *
 * Transcribed from the key builders in `portal-crm.ts` and `portal-leads.ts` on the agency
 * side, not from memory — that is the only place the shapes are decided, and this list is a
 * claim about them.
 *
 * It is a REGRESSION GUARD, and it passes today. `purgePortalSiteData` does not enumerate
 * families: it SCANs `portal:*:{acct}:{slug}` and `…:{slug}:*` and lets `isSiteScopedKey`
 * decide, so a family added to the portal is covered the moment it exists. That is a good
 * design and this list is what stops anyone quietly replacing it with an enumeration — the
 * archive set below arrived after the purge was written and needed no change to be deleted.
 *
 * Four of these (`activity`, `unread`, `task`, `promoted`) had never been listed, and the
 * two `archived` ones are new. The comment above them used to claim the list was complete
 * while it was missing six, which is exactly how a guard stops guarding.
 *
 * The Inbox read set (`portal:inbox:v1:read:{acct}:{slug}`, agency `portal-inbox-read.ts`,
 * 2026-11-12) is a new namespace rather than another `crm:v2` family, and the same SCAN takes
 * it. Listed so the claim that it does is checked rather than assumed.
 */
const OWN = [
  `portal:lead:v1:${ACCT}:acme:lead1`,
  `portal:lead:index:v1:${ACCT}:acme`,
  `portal:crm:v2:customer:${ACCT}:acme:c1`,
  `portal:crm:v2:index:${ACCT}:acme`,
  `portal:crm:v2:phone:${ACCT}:acme:+14075550100`,
  `portal:crm:v2:activity:${ACCT}:acme:c1`,
  `portal:crm:v2:thread:${ACCT}:acme:c1`,
  `portal:crm:v2:unread:${ACCT}:acme`,
  `portal:crm:v2:task:${ACCT}:acme:t1`,
  `portal:crm:v2:tasks:${ACCT}:acme`,
  `portal:crm:v2:promoted:${ACCT}:acme`,
  `portal:crm:v2:archived:${ACCT}:acme`,
  `portal:crm:v2:archived-at:${ACCT}:acme:recAAAAAAAAAAAAAA`,
  `portal:inbox:v1:read:${ACCT}:acme`,
];
/** Everything that must survive. */
const SURVIVORS = [
  // The sibling-prefix trap.
  `portal:lead:v1:${ACCT}:acme-2:lead9`,
  `portal:lead:index:v1:${ACCT}:acme-2`,
  `portal:crm:v2:customer:${ACCT}:acme-2:c9`,
  // The new families are in the trap as well: `acme-2`'s archive must outlive `acme`.
  `portal:crm:v2:archived:${ACCT}:acme-2`,
  `portal:crm:v2:archived-at:${ACCT}:acme-2:recBBBBBBBBBBBBBB`,
  `portal:inbox:v1:read:${ACCT}:acme-2`,
  // Account-scoped: shared by every site on the account.
  `portal:review:sent:v1:${ACCT}:+14075550100`,
  `portal:crm:v2:owner-email:${ACCT}`,
  // Same slug, different account.
  `portal:lead:v1:${OTHER}:acme:lead1`,
  `portal:crm:v2:index:${OTHER}:acme`,
  `portal:inbox:v1:read:${OTHER}:acme`,
  // Unrelated.
  `portal:number-owner:v1:+14075550100`,
  'jdd:account:someone',
];

/** Redis glob semantics: `*` matches any run of characters, colons included. */
const globToRegex = (pattern) =>
  new RegExp(`^${pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);

/**
 * An Upstash REST double. `scanIgnoresPattern` simulates a SCAN pattern that is too broad —
 * the case isSiteScopedKey exists to survive.
 */
/**
 * The token record in the RECORDED shape — a JSON string with exactly these two keys — carrying
 * this test's scope. The recorded value names _e2e_test_growth, which is the point of recording
 * it, but using it as-is would make every test purge a slug none of these keys belong to.
 */
const tokenRecordFor = (acctScope, slug) => {
  const recorded = JSON.parse(SHAPES.getTokenRecord.result);
  return JSON.stringify({ ...recorded, acctScope, slug });
};

function fakeUpstash({ keys, tokenRecord = tokenRecordFor(ACCT, 'acme'), scanIgnoresPattern = false, failOn = null }) {
  const store = new Set(keys);
  const calls = [];
  const deleted = [];
  const impl = async (url, init) => {
    const segs = new URL(url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const [cmd, ...args] = segs;
    calls.push({ cmd: cmd.toLowerCase(), args, method: init?.method });
    const reply = (result, status = 200) =>
      new Response(JSON.stringify(status === 200 ? { result } : { error: result }), { status });
    if (failOn && cmd.toLowerCase() === failOn) return reply('ERR simulated', 500);
    switch (cmd.toLowerCase()) {
      case 'get':
        return reply(args[0] === `portal:lead:token:v1:${TOKEN}` ? tokenRecord : null);
      case 'scan': {
        const [cursor, , pattern] = args;
        const all = [...store].sort();
        const matching = scanIgnoresPattern ? all : all.filter((k) => globToRegex(pattern).test(k));
        // Two keys per page, so the cursor loop is exercised for real.
        const start = Number(cursor);
        const page = matching.slice(start, start + 2);
        const next = start + 2 >= matching.length ? '0' : String(start + 2);
        return reply([next, page]);
      }
      case 'del': {
        let n = 0;
        for (const k of args) if (store.delete(k)) { n++; deleted.push(k); }
        return reply(n);
      }
      default:
        return reply(`unexpected command ${cmd}`, 500);
    }
  };
  return { impl, store, calls, deleted };
}

const BASE = { kvUrl: 'https://kv.example.upstash.io', kvToken: 'tok', siteSlug: 'acme' };

test('the recorded token record is a JSON string, not an object', () => {
  // Pins the premise the parser depends on. Treated as an object, `rec.acctScope` would be
  // undefined, the token would be silently ignored, and the purge would fall back to a scope
  // derived from an email that a --link-portal move may have made stale.
  assert.equal(typeof SHAPES.getTokenRecord.result, 'string');
  assert.deepEqual(Object.keys(JSON.parse(SHAPES.getTokenRecord.result)), ['acctScope', 'slug']);
  assert.equal(typeof SHAPES.scan.result[0], 'string', 'the SCAN cursor is a string');
});

test('isSiteScopedKey: own keys yes, sibling-prefix keys no', () => {
  for (const k of OWN) assert.equal(isSiteScopedKey(k, ACCT, 'acme'), true, k);
  assert.equal(isSiteScopedKey(`portal:lead:v1:${ACCT}:acme-2:lead9`, ACCT, 'acme'), false, 'acme-2 is not acme');
  assert.equal(isSiteScopedKey(`portal:lead:index:v1:${ACCT}:acme-2`, ACCT, 'acme'), false);
  assert.equal(isSiteScopedKey(`portal:lead:index:v1:${ACCT}:acmecorp`, ACCT, 'acme'), false);
});

test('isSiteScopedKey: account-scoped and other-account keys never match', () => {
  for (const k of SURVIVORS) assert.equal(isSiteScopedKey(k, ACCT, 'acme'), false, k);
});

test('THE REGRESSION: teardown purges this site’s portal data and nothing else', async () => {
  const kv = fakeUpstash({ keys: [...OWN, ...SURVIVORS, `portal:lead:token:v1:${TOKEN}`] });
  const res = await purgePortalSiteData({ ...BASE, ingestToken: TOKEN, fetchImpl: kv.impl });
  assert.equal(res.outcome, 'deleted', res.message);
  for (const k of OWN) assert.ok(!kv.store.has(k), `own key survived: ${k}`);
  assert.ok(!kv.store.has(`portal:lead:token:v1:${TOKEN}`), 'the ingest token must be revoked');
  for (const k of SURVIVORS) assert.ok(kv.store.has(k), `must NOT delete: ${k}`);
});

test('an over-broad SCAN still deletes only this site’s keys', async () => {
  // The defence-in-depth case. If a pattern were ever widened by a `{slug}*` slip, SCAN would
  // hand back the sibling's keys; the boundary filter has to stop them reaching DEL.
  const kv = fakeUpstash({ keys: [...OWN, ...SURVIVORS], scanIgnoresPattern: true });
  await purgePortalSiteData({ ...BASE, ingestToken: TOKEN, fetchImpl: kv.impl });
  for (const k of SURVIVORS) assert.ok(kv.store.has(k), `over-broad SCAN let this be deleted: ${k}`);
});

test('the scope comes from the ingest token, not a possibly-stale email', async () => {
  // A --link-portal --email move re-points the token, so after a move PORTAL_ACCOUNT_EMAIL can
  // name an account the leads no longer live under. The token record is what the agency
  // actually filed each lead with.
  const kv = fakeUpstash({ keys: [...OWN, ...SURVIVORS] });
  const res = await purgePortalSiteData({ ...BASE, accountEmail: OTHER_OWNER, ingestToken: TOKEN, fetchImpl: kv.impl });
  for (const k of OWN) assert.ok(!kv.store.has(k), 'should have purged under the token’s scope');
  assert.ok(kv.store.has(`portal:lead:v1:${OTHER}:acme:lead1`), 'and left the email-derived scope alone');
  assert.match(res.message, /ingest token/);
});

test('with no token, the caller’s fallback scope is used', async () => {
  const kv = fakeUpstash({ keys: [...OWN, ...SURVIVORS] });
  const res = await purgePortalSiteData({ ...BASE, accountEmail: OWNER, fetchImpl: kv.impl });
  assert.equal(res.outcome, 'deleted');
  for (const k of OWN) assert.ok(!kv.store.has(k));
  assert.match(res.message, /PORTAL_ACCOUNT_EMAIL/);
});

test('no KV credentials is a skip that says so, and touches nothing', async () => {
  const kv = fakeUpstash({ keys: OWN });
  const res = await purgePortalSiteData({ siteSlug: 'acme', accountEmail: OWNER, fetchImpl: kv.impl });
  assert.equal(res.outcome, 'skipped');
  assert.match(res.message, /NOT purged/);
  assert.equal(kv.calls.length, 0);
});

test('nothing identifying the site is a skip, never a guess', async () => {
  const kv = fakeUpstash({ keys: OWN });
  const res = await purgePortalSiteData({ kvUrl: BASE.kvUrl, kvToken: BASE.kvToken, fetchImpl: kv.impl });
  assert.equal(res.outcome, 'skipped');
  assert.equal(kv.deleted.length, 0);
});

test('a KV error is a failure, not a partial success reported as done', async () => {
  const kv = fakeUpstash({ keys: [...OWN, ...SURVIVORS], failOn: 'del' });
  const res = await purgePortalSiteData({ ...BASE, accountEmail: OWNER, fetchImpl: kv.impl });
  assert.equal(res.outcome, 'failed');
  assert.match(res.message, /NOT fully purged/);
});

test('a dry run counts the records and deletes none', async () => {
  const kv = fakeUpstash({ keys: [...OWN, ...SURVIVORS, `portal:lead:token:v1:${TOKEN}`] });
  const res = await purgePortalSiteData({ ...BASE, ingestToken: TOKEN, dryRun: true, fetchImpl: kv.impl });
  assert.equal(kv.deleted.length, 0, 'a dry run must not delete');
  assert.equal(res.keys.length, OWN.length + 1, 'every own key plus the token');
  // Derived, not a literal: the message is what the operator reads before confirming, and a
  // hardcoded total silently stops describing the fixture the moment a key family is added.
  assert.match(res.message, new RegExp(`Would purge ${OWN.length + 1} portal record`));
});

test('every KV command is sent as POST', async () => {
  // One request shape, matching clearNumberOwnerIndex's DEL — verified against the live KV for
  // GET, EXISTS and SCAN as well, so reads and writes share a form that is known to work.
  const kv = fakeUpstash({ keys: OWN });
  await purgePortalSiteData({ ...BASE, ingestToken: TOKEN, fetchImpl: kv.impl });
  assert.ok(kv.calls.length > 0);
  for (const c of kv.calls) assert.equal(c.method, 'POST', `${c.cmd} was not POSTed`);
});

test('a token filed under a different slug wins, and the disagreement is reported', async () => {
  // .env.local and the portal disagreeing about what a site is called is worth knowing about
  // during a teardown. The purge follows the token — it is what the leads were filed under —
  // but it must not do so silently.
  const kv = fakeUpstash({ keys: [...OWN, ...SURVIVORS], tokenRecord: tokenRecordFor(ACCT, 'acme') });
  const res = await purgePortalSiteData({ ...BASE, siteSlug: 'acme-renamed', ingestToken: TOKEN, fetchImpl: kv.impl });
  for (const k of OWN) assert.ok(!kv.store.has(k), 'should purge what the token filed under');
  assert.match(res.message, /filed as "acme", not "acme-renamed"/);
});

test('results use the same StepResult shape as every other teardown primitive', async () => {
  // The console writes its receipt from `resource`/`target`/`outcome`/`durationMs`, and the
  // CLI formats the same fields. A bare `{ outcome, message }` renders as a blank row.
  const kv = fakeUpstash({ keys: [...OWN] });
  const res = await purgePortalSiteData({ ...BASE, ingestToken: TOKEN, fetchImpl: kv.impl });
  assert.equal(res.resource, 'portal.data');
  assert.equal(res.target, 'acme');
  assert.equal(typeof res.durationMs, 'number');
});

test('nothing left to purge is already-gone, not a zero-count success', async () => {
  const kv = fakeUpstash({ keys: [...SURVIVORS] });
  const res = await purgePortalSiteData({ ...BASE, accountEmail: OWNER, fetchImpl: kv.impl });
  assert.equal(res.outcome, 'already-gone');
});

test('an enterprise teardown clears every site’s inbox read set, and no other client’s', async () => {
  // Xander, 2026-11-12: the Inbox read records go when a client is torn down. The console's
  // teardown (`/api/manage/teardown`) runs this purge once per site of the client, so an
  // enterprise client with `acme` and `acme-2` loses both read sets. Another client's read set,
  // under the same slug, stays.
  const mine = [`portal:inbox:v1:read:${ACCT}:acme`, `portal:inbox:v1:read:${ACCT}:acme-2`];
  const theirs = [`portal:inbox:v1:read:${OTHER}:acme`, `portal:inbox:v1:read:${OTHER}:acme-2`];
  const kv = fakeUpstash({ keys: [...mine, ...theirs] });
  for (const siteSlug of ['acme', 'acme-2']) {
    const res = await purgePortalSiteData({ ...BASE, siteSlug, accountEmail: OWNER, fetchImpl: kv.impl });
    assert.equal(res.outcome, 'deleted', res.message);
  }
  for (const k of mine) assert.ok(!kv.store.has(k), `read set survived teardown: ${k}`);
  for (const k of theirs) assert.ok(kv.store.has(k), `another client’s read set was deleted: ${k}`);
});
