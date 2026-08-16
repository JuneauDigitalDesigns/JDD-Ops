#!/usr/bin/env node
/**
 * scripts/backfill-client-records.js — create a ClientRecord for every client that
 * already exists.
 *
 * The record (jdd:client:{id}) is the spine the console's lifecycle hangs off: it joins a
 * lead to a client to a churn, and it is what reconcile iterates to know which sites a
 * client actually has. onboard.js writes one for every client provisioned from now on;
 * this backfills everyone who predates that.
 *
 * Source of truth for the mapping is the **portal account record**, not the clients/
 * folder, for one reason: the record is keyed on email and the folder has no email in it.
 * Disk supplies the site slugs and confirms the folder exists; KV supplies who owns it.
 * A client with a folder but no account record therefore cannot be backfilled here — it
 * is reported, because that combination is itself a problem worth seeing.
 *
 * Audit by default; writes only with `--apply` — same contract as `repair-portal` and
 * `backfill-agent-ids`.
 *
 * `_`-prefixed slugs are e2e fixtures and are skipped, matching isFixtureSlug() in the
 * console. They are skipped on BOTH sides — several have real account records left behind
 * in production KV by test runs, and creating client records for them would put test data
 * on the roster permanently. `--fixtures` includes them if you actually want that.
 *
 * Usage:
 *   node scripts/backfill-client-records.js            # audit, write nothing
 *   node scripts/backfill-client-records.js --apply    # create the missing records
 *   node scripts/backfill-client-records.js --email a@b.com   # limit to one account
 *   node scripts/backfill-client-records.js --fixtures # include _e2e-* fixtures
 */

import 'dotenv/config';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { accountStoreConfigured, listAccounts, getAccountRecord } from '../lib/account-store.js';
import {
  clientRecordsConfigured,
  ensureClientRecord,
  getClientRecordBySlug,
  getClientRecordByEmail,
} from '../lib/client-record-store.js';

function fail(msg, err) {
  console.error(`backfill-client-records: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { apply: false, email: null, fixtures: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--fixtures') args.fixtures = true;
    else if (a === '--email' && argv[i + 1]) args.email = argv[++i];
    else if (a.startsWith('--')) fail(`unknown flag ${a}`);
  }
  return args;
}

/** Matches isFixtureSlug() in the console — `_`-prefixed folders are e2e test data. */
const isFixtureSlug = (slug) => slug.startsWith('_');

/**
 * Map an account's sites onto one client record per base slug.
 *
 * Enterprise sites are `baseSlug-1..N` and belong to ONE relationship, so they collapse to
 * a single record carrying every site slug. Getting this wrong is not cosmetic: reconcile
 * iterates `siteSlugs`, so a per-site record would check site 1 three times and sites 2
 * and 3 never.
 */
function groupSitesByBase(sites) {
  const groups = new Map();
  for (const site of sites) {
    const base = /-\d+$/.test(site.slug) ? site.slug.replace(/-\d+$/, '') : site.slug;
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(site.slug);
  }
  return groups;
}

/** Folders under clients/. Fixtures are included or not on the SAME terms as accounts. */
function clientFoldersOnDisk(includeFixtures) {
  const dir = resolve('clients');
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() &&
          !d.name.startsWith('.') &&
          (includeFixtures || !isFixtureSlug(d.name)),
      )
      .map((d) => d.name),
  );
}

async function main() {
  const { apply, email, fixtures } = parseArgs(process.argv);
  if (!accountStoreConfigured() || !clientRecordsConfigured()) {
    fail('KV not configured — set KV_REST_API_URL / KV_REST_API_TOKEN in .env');
  }

  const accounts = email
    ? [await getAccountRecord(email)].filter(Boolean)
    : await listAccounts();
  if (!accounts.length) fail(email ? `No account for ${email}.` : 'No accounts found in KV.');

  const onDisk = clientFoldersOnDisk(fixtures);
  const claimed = new Set();

  console.log(`${apply ? '' : '[audit — no writes] '}Scanning ${accounts.length} account(s)\n`);

  let created = 0;
  let ready = 0;
  let already = 0;
  let noFolder = 0;
  let skippedFixtures = 0;

  for (const account of accounts) {
    const groups = groupSitesByBase(account.sites ?? []);

    for (const [base, siteSlugs] of groups) {
      const label = `${account.email} / ${base}`;

      // Test runs have left real account records for `_e2e-*` slugs in production KV.
      // Backfilling them would put test data on the roster permanently.
      if (isFixtureSlug(base) && !fixtures) {
        skippedFixtures++;
        console.log(`  · ${label} — e2e fixture, skipped`);
        continue;
      }

      claimed.add(base);

      const existing =
        (await getClientRecordBySlug(base)) ?? (await getClientRecordByEmail(account.email));
      if (existing) {
        already++;
        console.log(`  = ${label} — already ${existing.id}`);
        continue;
      }

      // Not fatal — an enterprise site can be provisioned on another machine, and a
      // pending-onboarding site legitimately has no folder yet. Worth naming either way.
      if (!onDisk.has(base)) {
        noFolder++;
        console.warn(`  ! ${label} — no clients/${base} folder on this machine`);
      }

      ready++;
      if (apply) {
        const rec = await ensureClientRecord({
          email: account.email,
          slug: base,
          siteSlugs,
          // Deliberately NOT setting a stage: the record is created at its default and the
          // first reconcile derives the real one from live evidence. Guessing a stage from
          // an account record alone would bake in a wrong answer that looks authoritative.
        });
        created++;
        console.log(`  ✓ ${label} — ${rec.id} (${siteSlugs.length} site(s))`);
      } else {
        console.log(`  ~ ${label} — would create (${siteSlugs.length} site(s))`);
      }
    }
  }

  // A folder nobody's account claims. These are exactly the clients the console would
  // show but the portal has never heard of, which is worth surfacing on its own.
  const orphanFolders = [...onDisk].filter((slug) => !claimed.has(slug));

  console.log(
    `\nRecords — ${apply ? 'created' : 'to create'}: ${apply ? created : ready} · ` +
      `already present: ${already} · no folder on this machine: ${noFolder}` +
      (skippedFixtures ? ` · e2e fixtures skipped: ${skippedFixtures}` : ''),
  );

  if (orphanFolders.length) {
    console.log(
      `\nclients/ folders with no portal account (not backfilled):\n` +
        orphanFolders.map((s) => `  - ${s}`).join('\n') +
        `\n  Attach them with \`npm run link-portal\`, then re-run.`,
    );
  }

  if (!apply && ready > 0) console.log('\nRe-run with --apply to write these.');
}

main().catch((err) => fail('unhandled error', err));
