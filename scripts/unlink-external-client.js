#!/usr/bin/env node
/**
 * scripts/unlink-external-client.js — the exact reverse of link-external-client.js.
 *
 * Removes the Atlantic Compressor + Air Service of Florida relationship from the portal +
 * lifecycle KV, as part of handing both sites to the client. This is the JDD-side decoupling
 * ONLY: it touches nothing at GitHub, Vercel, Resend, Retell, Twilio, Make or Airtable, all of
 * which are the client's property under the separate ownership migration.
 *
 * ── Why this is not the teardown route ──────────────────────────────────────
 *
 * console/src/app/api/manage/teardown/route.ts already archives, detaches and removes a
 * client's console presence — and then deletes its Vercel project, GitHub repo, Retell agent
 * and LLM, Twilio number, Make scenario and Airtable base. That is correct for a cancelled
 * client and catastrophic for a transferred one. This script is the detach-only subset:
 * teardown's phase 1, and nothing else.
 *
 * ── What it does ────────────────────────────────────────────────────────────
 *
 *   jdd:account:sales@atlanticcompressor.com    DELETE  the client's portal account
 *   jdd:client:{id}                             DELETE  the ClientRecord spanning both slugs
 *   jdd:client:by-slug:atlantic-compressor      DELETE  via deleteClientRecord (record.slug)
 *   jdd:client:by-slug:air-service-florida      DELETE  BY HAND — see the asymmetry below
 *   jdd:client:by-email:sales@...               DELETE  via deleteClientRecord
 *   jdd:client:index                            ZREM    the id; the set itself stays
 *   jdd:account:xanderjuneau@gmail.com          EDIT    drop air-service-florida from sites[]
 *   jdd:account-by-user:{clerkUserId}           UNTOUCHED — that index is the agency's own
 *
 * The by-slug asymmetry mirrors the linker exactly: saveClientRecord only writes an index for
 * record.slug, so link-external-client.js:114 set the air-service-florida index by hand. Its
 * removal has to be by hand for the same reason — deleteClientRecord cannot know about it.
 *
 * The edit to the agency's own account is not cosmetic. A portal.attach on 2026-10-07 put
 * air-service-florida on xanderjuneau@gmail.com and was never undone, so detaching the
 * client's account alone would leave the site listed in our own portal.
 *
 * Audit by default; writes only with `--apply`, matching link-external-client.js and
 * backfill-client-records.js.
 *
 * Usage:
 *   node scripts/unlink-external-client.js            # audit, write nothing
 *   node scripts/unlink-external-client.js --apply    # perform the removal
 */

import 'dotenv/config';
import { Redis } from '@upstash/redis';
import {
  detachSiteFromAccount,
  getAccountRecord,
  accountStoreConfigured,
} from '../lib/account-store.js';
import {
  getClientRecordBySlug,
  deleteClientRecord,
  clientRecordsConfigured,
} from '../lib/client-record-store.js';
import { accountKey, clientKey, clientBySlugKey, clientByEmailKey, CLIENT_INDEX_KEY } from '@jdd/schema';

const EMAIL = 'sales@atlanticcompressor.com';
const AGENCY_EMAIL = 'xanderjuneau@gmail.com';
const PRIMARY_SLUG = 'atlantic-compressor';
const SECONDARY_SLUG = 'air-service-florida';
const SITE_SLUGS = [PRIMARY_SLUG, SECONDARY_SLUG];

/**
 * The prod KV. Named here rather than read from the environment, because the whole point of
 * the check is to catch an environment that points somewhere else: console/.env.local has
 * been pinned to the test KV (rich-eel) before, and a delete run against the wrong store
 * removes nothing, reports success, and leaves prod exactly as it was.
 */
const EXPECTED_KV_HOST_FRAGMENT = 'tolerant-pug';

const apply = process.argv.includes('--apply');

function log(...args) {
  console.log(...args);
}

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return new Redis({ url, token });
}

/** Read one key's current value for the report, tolerating the zset. */
async function peek(redis, key) {
  const type = await redis.type(key);
  if (type === 'none') return { exists: false, type: null, value: null };
  if (type === 'zset') return { exists: true, type, value: await redis.zrange(key, 0, -1) };
  return { exists: true, type, value: await redis.get(key) };
}

function brief(value) {
  if (value === null || value === undefined) return '—';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
}

async function main() {
  if (!accountStoreConfigured() || !clientRecordsConfigured()) {
    console.error('KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env.');
    process.exit(1);
  }

  // ── Guard 1: the right store ──────────────────────────────────────────────
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvHost = new URL(kvUrl).host;
  if (!kvHost.includes(EXPECTED_KV_HOST_FRAGMENT)) {
    console.error(
      `\nREFUSING: KV host is ${kvHost}, which is not prod (${EXPECTED_KV_HOST_FRAGMENT}).\n` +
        'Deleting from the test KV would report success while prod kept every record.\n',
    );
    process.exit(1);
  }

  const redis = getRedis();

  // ── Guard 2: resolve the id live, never hardcode it ───────────────────────
  const record = await getClientRecordBySlug(PRIMARY_SLUG);
  if (!record) {
    console.error(
      `\nREFUSING: no client record resolves from ${clientBySlugKey(PRIMARY_SLUG)}.\n` +
        'Either this has already run, or the store is not the one that holds this client.\n',
    );
    process.exit(1);
  }
  const id = record.id;

  log(`\n${apply ? 'APPLYING' : 'DRY RUN (pass --apply to write)'} — unlink ${SITE_SLUGS.join(' + ')}`);
  log(`KV host:   ${kvHost}`);
  log(`client id: ${id}`);
  log(`record:    slug=${record.slug} siteSlugs=[${(record.siteSlugs ?? []).join(', ')}] stage=${record.stage}/${record.stageOverride ?? '-'}\n`);

  // Sanity: the record we are about to delete should be the two-site relationship we think it
  // is. A record that has grown a third site, or lost one, means the world moved since this
  // script was written and the operator should look before deleting.
  const unexpected = (record.siteSlugs ?? []).filter((s) => !SITE_SLUGS.includes(s));
  const missing = SITE_SLUGS.filter((s) => !(record.siteSlugs ?? []).includes(s));
  if (unexpected.length || missing.length) {
    console.error('REFUSING: the client record is not the expected two-site relationship.');
    if (unexpected.length) console.error(`  unexpected site slugs: ${unexpected.join(', ')}`);
    if (missing.length) console.error(`  missing site slugs:    ${missing.join(', ')}`);
    console.error('  Review it by hand before running this.\n');
    process.exit(1);
  }

  // ── The report ────────────────────────────────────────────────────────────
  const plan = [
    [accountKey(EMAIL), 'DELETE', "the client's portal account"],
    [clientKey(id), 'DELETE', 'the ClientRecord'],
    [clientBySlugKey(PRIMARY_SLUG), 'DELETE', 'primary slug index'],
    [clientBySlugKey(SECONDARY_SLUG), 'DELETE', 'secondary slug index (by hand)'],
    [clientByEmailKey(EMAIL), 'DELETE', 'email index'],
    [CLIENT_INDEX_KEY, 'ZREM', `member ${id}; the set itself stays`],
    [accountKey(AGENCY_EMAIL), 'EDIT', `drop ${SECONDARY_SLUG} from sites[]`],
  ];

  log('Keys this run will change:\n');
  for (const [key, op, note] of plan) {
    const { exists, type, value } = await peek(redis, key);
    log(`  ${op.padEnd(6)} ${key}`);
    log(`         ${exists ? `${type}: ${brief(value)}` : 'ABSENT'}`);
    log(`         ${note}\n`);
  }

  const agencyAccount = await getAccountRecord(AGENCY_EMAIL);
  if (agencyAccount?.clerkUserId) {
    const untouched = `jdd:account-by-user:${agencyAccount.clerkUserId}`;
    const { value } = await peek(redis, untouched);
    log(`  KEEP   ${untouched}`);
    log(`         string: ${brief(value)}`);
    log('         the agency\'s own index — never touched\n');
  }

  if (!apply) {
    log('Nothing written. Re-run with --apply to perform the removal.\n');
    return;
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  //
  // Order follows teardown's principle: revoke visibility before removing records, so a run
  // that dies partway leaves the sites already hidden rather than still listed against a
  // record that no longer exists. Detaching from the client's account before deleting that
  // same account is therefore deliberate redundancy, not an oversight.
  log('— applying —\n');

  for (const slug of SITE_SLUGS) {
    const next = await detachSiteFromAccount(EMAIL, slug);
    log(`  ✓ detached ${slug} from ${EMAIL} (${next ? `${next.sites.length} site(s) left` : 'account absent'})`);
  }

  const agencyNext = await detachSiteFromAccount(AGENCY_EMAIL, SECONDARY_SLUG);
  log(`  ✓ detached ${SECONDARY_SLUG} from ${AGENCY_EMAIL} (${agencyNext ? `${agencyNext.sites.length} site(s) left` : 'account absent'})`);

  const deleted = await deleteClientRecord(id);
  log(`  ${deleted ? '✓' : '·'} client record ${id}${deleted ? ' deleted (record, by-email, primary by-slug, index member)' : ' already gone'}`);

  await redis.del(clientBySlugKey(SECONDARY_SLUG));
  log(`  ✓ deleted ${clientBySlugKey(SECONDARY_SLUG)} (the hand-written index)`);

  await redis.del(accountKey(EMAIL));
  log(`  ✓ deleted ${accountKey(EMAIL)}\n`);

  // ── Verify: the run proves itself, or exits non-zero ──────────────────────
  log('— verifying —\n');
  let failures = 0;
  const check = (ok, label) => {
    log(`  ${ok ? '✓' : '✗'} ${label}`);
    if (!ok) failures += 1;
  };

  for (const key of [
    accountKey(EMAIL),
    clientKey(id),
    clientBySlugKey(PRIMARY_SLUG),
    clientBySlugKey(SECONDARY_SLUG),
    clientByEmailKey(EMAIL),
  ]) {
    const { exists } = await peek(redis, key);
    check(!exists, `${key} is gone`);
  }

  const score = await redis.zscore(CLIENT_INDEX_KEY, id);
  check(score === null || score === undefined, `${CLIENT_INDEX_KEY} no longer holds ${id}`);

  const agencyAfter = await getAccountRecord(AGENCY_EMAIL);
  check(Boolean(agencyAfter), `${accountKey(AGENCY_EMAIL)} still exists`);
  check(
    !(agencyAfter?.sites ?? []).some((s) => s.slug === SECONDARY_SLUG),
    `${AGENCY_EMAIL} no longer lists ${SECONDARY_SLUG}`,
  );
  check(
    agencyAfter?.clerkUserId === agencyAccount?.clerkUserId,
    `${AGENCY_EMAIL} clerkUserId preserved (${agencyAfter?.clerkUserId ?? 'null'})`,
  );
  if (agencyAccount?.clerkUserId) {
    const { value } = await peek(redis, `jdd:account-by-user:${agencyAccount.clerkUserId}`);
    check(value === AGENCY_EMAIL, `jdd:account-by-user:${agencyAccount.clerkUserId} still maps to ${AGENCY_EMAIL}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} verification check(s) failed — inspect KV before doing anything else.\n`);
    process.exit(1);
  }
  log('\nDone. Both sites are decoupled from the console; archives are at ops/client-archives/.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
