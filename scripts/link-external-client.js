#!/usr/bin/env node
/**
 * scripts/link-external-client.js — bring the two externally-built starter sites (Atlantic
 * Compressor + Air Service of Florida) into the portal + lifecycle KV as ONE client owned by
 * one login.
 *
 * These sites are custom repos we only manage from the console (see their site.ts
 * `_meta.externalManaged`). They were never provisioned by onboard.js, so they have no portal
 * account or client record. This writes both, so the owner can sign up once at /portal/sign-up
 * with the account email and see both sites, and so reconcile/billing treat them as one live,
 * off-platform-billed relationship.
 *
 *   jdd:account:{email}                → PortalAccount with both sites (status live)
 *   jdd:client:{id}                    → one ClientRecord, siteSlugs = both, stageOverride live
 *   jdd:client:by-slug:{both slugs}    → that id
 *
 * Idempotent: upsertSite/ensureClientRecord preserve existing state, so re-running is safe.
 * Audit by default; writes only with `--apply`, matching backfill-client-records.js.
 *
 * Usage:
 *   node scripts/link-external-client.js            # audit, write nothing
 *   node scripts/link-external-client.js --apply    # create the account + client record
 */

import 'dotenv/config';
import { Redis } from '@upstash/redis';
import { attachSiteToAccount, getAccountRecord, accountStoreConfigured } from '../lib/account-store.js';
import {
  ensureClientRecord,
  getClientRecordBySlug,
  saveClientRecord,
  clientRecordsConfigured,
} from '../lib/client-record-store.js';
import { setStageOverride, clientBySlugKey } from '@jdd/schema';

const EMAIL = 'sales@atlanticcompressor.com';
const PRIMARY_SLUG = 'atlantic-compressor';
const SITES = [
  {
    slug: 'atlantic-compressor',
    name: 'Atlantic Compressor',
    canonical: 'https://www.atlanticcompressor.com',
    vercelProjectId: 'prj_XCP5LW5vd12Nsjj20luYJRdbF21f',
  },
  {
    slug: 'air-service-florida',
    name: 'Air Service of Florida',
    canonical: 'https://www.airserviceofflorida.com',
    vercelProjectId: 'prj_fMAZzwXLYDmmEdYESeZ4ebdmd66Q',
  },
];
const SITE_SLUGS = SITES.map((s) => s.slug);

const apply = process.argv.includes('--apply');

function log(...args) {
  console.log(...args);
}

async function main() {
  if (!accountStoreConfigured() || !clientRecordsConfigured()) {
    console.error('KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env.');
    process.exit(1);
  }

  log(`\n${apply ? 'APPLYING' : 'DRY RUN (pass --apply to write)'} — account ${EMAIL}\n`);

  // 1. Portal account: one record, both sites, status live.
  //
  // `receptionistMode: 'declined'` makes these web-only, which is what they actually are: custom
  // externally-built sites with no JDD receptionist, no number, no Airtable. This matters since
  // the 2026-10-12 reprice, when `siteFeature` stopped gating call data on `plan === 'starter'`.
  // Without the declined mode a live Starter site with no Airtable base resolves to
  // `connecting` (our drift) rather than `not-on-plan`, and the portal would show these two real
  // clients a call-log tab that can never load. The declined mode restores `not-on-plan`.
  for (const s of SITES) {
    const site = {
      slug: s.slug,
      name: s.name,
      canonical: s.canonical,
      plan: 'starter',
      receptionistMode: 'declined',
      status: 'live',
      airtableBaseId: null,
      vercelProjectId: s.vercelProjectId,
      addedAt: Date.now(),
    };
    log(`  site ${s.slug}: plan=starter (web-only, declined) status=live vercel=${s.vercelProjectId}`);
    if (apply) await attachSiteToAccount(EMAIL, site);
  }

  // 2. Client record: one relationship spanning both sites. stageOverride 'live' because there is
  //    no Stripe subscription (off-platform billing) and no lead, so the derived stage rules would
  //    otherwise refuse to call it live.
  log(`  client record: slug=${PRIMARY_SLUG} siteSlugs=[${SITE_SLUGS.join(', ')}] stage=live (override)`);
  if (apply) {
    let rec = await ensureClientRecord({
      email: EMAIL,
      slug: PRIMARY_SLUG,
      siteSlugs: SITE_SLUGS,
      leadId: null,
      stage: 'live',
    });
    if (rec.stageOverride !== 'live') {
      rec = setStageOverride(rec, 'live');
      await saveClientRecord(rec);
    }

    // 3. Second by-slug index so the Air Service card/route resolves to the same client.
    //    saveClientRecord only writes the index for record.slug (the primary).
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    const redis = new Redis({ url, token });
    await redis.set(clientBySlugKey('air-service-florida'), rec.id);
    log(`  client id: ${rec.id}`);
  }

  if (apply) {
    const account = await getAccountRecord(EMAIL);
    const rec = await getClientRecordBySlug(PRIMARY_SLUG);
    log(`\nDone. Account has ${account?.sites?.length ?? 0} site(s); client stage=${rec?.stage} override=${rec?.stageOverride}.`);
    log(`Owner signs up at /portal/sign-up with ${EMAIL} to link and see both sites.\n`);
  } else {
    log('\nNothing written. Re-run with --apply to create these records.\n');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
