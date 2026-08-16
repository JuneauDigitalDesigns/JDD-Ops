#!/usr/bin/env node
/**
 * scripts/backfill-account-agent-ids.js — put each site's Retell agent id on its
 * portal account record.
 *
 * Minute accounting reads usage from Retell, not from the Airtable call log: the log
 * depends on a post-call automation that can silently miss rows, so it under-counts.
 * Reading Retell needs a client → agent mapping, and until now `RETELL_AGENT_ID` lived
 * only in `clients/{slug}/.env.local` on this machine and in the client project's Vercel
 * env — neither of which the portal or a cron can see.
 *
 * onboard.js writes `retellAgentId` onto the account record from here on. This backfills
 * everything provisioned before that.
 *
 * Audit by default; writes only with `--apply` — same contract as `repair-portal`.
 *
 * Usage:
 *   node scripts/backfill-account-agent-ids.js              # audit, write nothing
 *   node scripts/backfill-account-agent-ids.js --apply      # write the resolved ids
 *   node scripts/backfill-account-agent-ids.js --email a@b.com   # limit to one account
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { upsertSite, zPortalAccount } from '@jdd/schema';
import {
  accountStoreConfigured,
  listAccounts,
  getAccountRecord,
  saveAccountRecord,
} from '../lib/account-store.js';

function fail(msg, err) {
  console.error(`backfill-account-agent-ids: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { apply: false, email: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--email' && argv[i + 1]) args.email = argv[++i];
    else if (a.startsWith('--')) fail(`unknown flag ${a}`);
  }
  return args;
}

/** Parse clients/{slug}/.env.local into a plain object (returns {} if absent). */
function readEnvLocal(slug) {
  const envPath = resolve('clients', slug, '.env.local');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

async function main() {
  const { apply, email } = parseArgs(process.argv);
  if (!accountStoreConfigured()) {
    fail('KV not configured — set KV_REST_API_URL / KV_REST_API_TOKEN in .env');
  }

  // listAccounts() returns whole records, not addresses.
  const accounts = email
    ? [await getAccountRecord(email)].filter(Boolean)
    : await listAccounts();
  if (!accounts.length) fail(email ? `No record for ${email}.` : 'No accounts found in KV.');

  console.log(`${apply ? '' : '[audit — no writes] '}Scanning ${accounts.length} account(s)\n`);

  let wrote = 0, ready = 0, already = 0, missing = 0, skipped = 0;

  for (const account of accounts) {
    const addr = account.email;
    let next = account;
    let touched = false;

    for (const site of account.sites ?? []) {
      const label = `${addr} / ${site.slug}`;

      if (site.plan === 'starter') {
        skipped++;
        console.log(`  - ${label} — starter, no agent by design`);
        continue;
      }
      if (site.retellAgentId) {
        already++;
        console.log(`  = ${label} — already ${site.retellAgentId}`);
        continue;
      }

      const agentId = readEnvLocal(site.slug).RETELL_AGENT_ID;
      if (!agentId) {
        // Not an error: the client may live on another machine, or never have been
        // provisioned. Saying so is more useful than silently writing nothing.
        missing++;
        console.warn(`  ! ${label} — no RETELL_AGENT_ID in clients/${site.slug}/.env.local`);
        continue;
      }

      ready++;
      console.log(`  ${apply ? '✓' : '~'} ${label} — ${apply ? 'set' : 'would set'} ${agentId}`);
      next = upsertSite(next, { slug: site.slug, retellAgentId: agentId });
      touched = true;
    }

    if (touched && apply) {
      // Validate before writing: this script is the only writer that fabricates a field
      // from disk, so a malformed record must not reach KV.
      const parsed = zPortalAccount.safeParse(next);
      if (!parsed.success) {
        console.error(`  ! ${addr} — record failed validation, not written:`);
        console.error(`    ${JSON.stringify(parsed.error.issues).slice(0, 300)}`);
        continue;
      }
      await saveAccountRecord(next);
      wrote++;
    }
  }

  console.log(
    `\n${apply ? 'Accounts written' : 'Accounts that would change'}: ${apply ? wrote : ready > 0 ? '(run with --apply)' : 0}`,
  );
  console.log(
    `Sites — ${apply ? 'set' : 'resolvable'}: ${ready} · already set: ${already} · ` +
      `no id on disk: ${missing} · starter (n/a): ${skipped}`,
  );
  if (!apply && ready > 0) console.log('\nRe-run with --apply to write these.');
}

main().catch((err) => fail('unhandled error', err));
