#!/usr/bin/env node
/**
 * scripts/seed-search-proposal.js — put ONE test spoke proposal in front of the /manage Search
 * screen, for a front-to-back test run on an `_e2e_` fixture.
 *
 *   npm run seed-search-proposal -- --slug _e2e_test_starter --town Minneola --service ac-repair          (preview)
 *   npm run seed-search-proposal -- --slug _e2e_test_starter --town Minneola --service ac-repair --write
 *
 * A new Search Console property has no data for months, so the agency's nightly job can't make a
 * proposal during a test. This writes the record that job would write (lib/search-approvals.js
 * testFixtureProposal), marked `test: true` and with a "(test)" query, under the fixture's own
 * account scope, in the KV named by THIS checkout's .env (run it from the test worktree for the
 * test KV). Refuses anything else. Prints key names, never the
 * account's email.
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Redis } from '@upstash/redis';
import { parseEnvLocal } from '../lib/teardown-ops.js';
import { accountScope } from '../lib/account-store.js';
import { townSlug } from '@jdd/schema';
import { proposalKey, proposalIndexKey, testFixtureProposal, isTestClient } from '../lib/search-approvals.js';

const argv = process.argv.slice(2);
const arg = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const die = (m) => {
  console.error(m);
  process.exit(1);
};

const slug = arg('slug');
const townArg = arg('town');
const service = arg('service');
const write = argv.includes('--write');
if (!slug || !townArg || !service) die('usage: --slug <_e2e_ fixture> --town <town> --service <service slug> [--write]');
if (!isTestClient(slug)) die(`refusing: ${slug} is not a test client (_e2e_, or named in SEARCH_SEED_TEST_SLUGS in this checkout's .env)`);

const dir = resolve('clients', slug);
if (!existsSync(resolve(dir, '.env.local'))) die(`no clients/${slug}/.env.local`);
const env = parseEnvLocal(resolve(dir, '.env.local'));

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) die('KV_REST_API_URL / KV_REST_API_TOKEN not set in .env');
const redis = new Redis({ url, token });

let email = env.PORTAL_ACCOUNT_EMAIL || null;
if (!email && env.CLERK_USER_ID) email = (await redis.get(`jdd:account-by-user:${env.CLERK_USER_ID}`)) || null;
if (!email) die(`clients/${slug} has no portal account (PORTAL_ACCOUNT_EMAIL / CLERK_USER_ID)`);
const acct = accountScope(email);

// The town as the client spells it, and its page slug: from the published search profile when
// Search Console was set up for this client, else from the arguments as given (an isolated test
// client that was never verified has no profile; the screen then shows the service by its slug).
const profile = await redis.get(`jdd:seo:profile:v1:${acct}:${slug}`);
let town = { name: townArg.trim(), slug: townSlug(townArg.trim()), hub: null, qualifies: null };
if (profile) {
  const found = profile.towns?.find((t) => t.name.toLowerCase() === townArg.trim().toLowerCase());
  if (!found) die(`${townArg} is not one of this client's towns (${(profile.towns ?? []).map((t) => t.name).join(', ')})`);
  if (!profile.services?.some((s) => s.slug === service)) die(`${service} is not one of this client's services (${(profile.services ?? []).map((s) => s.slug).join(', ')})`);
  town = found;
} else {
  console.log('no search profile (Search Console not set up for this client): using the town and service as given');
}

const proposal = testFixtureProposal({ slug, town: town.name, townSlug: town.slug, service });
const key = proposalKey(acct, slug, proposal.id);
console.log(`${write ? 'writing' : 'would write'} ${key} (${proposal.kind}, ${town.name} × ${service})`);
if (profile) {
  console.log(`  town has a page: ${town.hub ? 'yes' : town.qualifies ? 'qualifies' : 'NO, so Approve will list it but the Studio will not build it'}`);
  console.log(`  facts shared by town and service: ${profile.sharedFacts?.[`${town.name}|${service}`] ?? 0} (the Studio needs 2)`);
}
if (!write) {
  console.log('preview only; add --write');
  process.exit(0);
}
await redis.set(key, proposal);
await redis.zadd(proposalIndexKey(acct, slug), { score: Date.parse(proposal.createdAt), member: proposal.id });
console.log('done: open /manage › Search for this fixture');
