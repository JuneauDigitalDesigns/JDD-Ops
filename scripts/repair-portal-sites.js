#!/usr/bin/env node
/**
 * scripts/repair-portal-sites.js — audit and repair the portal's KV account records.
 *
 * The portal decides what a client can see from the ids stored on their account record
 * (`jdd:account:{email}`), not from anything on disk. When one of those ids is missing on
 * a site that is already live, the client sees a tab stuck on "we're finishing your setup"
 * and nothing in the product ever fixes it — the writers only run at provisioning time.
 * This is the tool that fixes it.
 *
 * It is an editor, not a migration: it proposes nothing on its own beyond telling you what
 * looks wrong, and it never writes without `--apply`.
 *
 * Usage:
 *   npm run repair-portal
 *       Audit every account. Lists each site with its feature states and flags drift.
 *
 *   npm run repair-portal -- --email a@b.com --slug acme --vercel-project-id prj_123
 *       Show the diff for one site. Add --apply to write it.
 *
 * Field flags (all optional, combine freely):
 *   --airtable-base-id <id>        --clear-airtable-base-id
 *   --vercel-project-id <id>       --clear-vercel-project-id
 *   --stripe-subscription-id <id>  --clear-stripe-subscription-id
 *   --canonical <url>              --clear-canonical
 *   --status <pending-onboarding|building|live>
 *   --plan <starter|growth|enterprise>
 *
 * The --clear-* forms write an explicit null ("I looked and there is nothing"), which is a
 * different statement from omitting the flag ("leave whatever is stored"). That difference
 * is the whole reason buildPortalSiteEntries had a bug, so it is surfaced here rather than
 * hidden behind an empty string.
 */

import 'dotenv/config';
import {
  upsertSite,
  siteFeatures,
  zPortalAccount,
} from '@jdd/schema';
import {
  accountStoreConfigured,
  listAccounts,
  getAccountRecord,
  saveAccountRecord,
} from '../lib/account-store.js';

const PLANS = ['starter', 'growth', 'enterprise'];
const STATUSES = ['pending-onboarding', 'building', 'live'];

function fail(msg) {
  console.error(`repair-portal-sites: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { apply: false, email: null, slug: null, set: {} };
  const takesValue = {
    '--email': 'email',
    '--slug': 'slug',
    '--airtable-base-id': 'airtableBaseId',
    '--vercel-project-id': 'vercelProjectId',
    '--stripe-subscription-id': 'stripeSubscriptionId',
    '--canonical': 'canonical',
    '--status': 'status',
    '--plan': 'plan',
  };
  const clears = {
    '--clear-airtable-base-id': 'airtableBaseId',
    '--clear-vercel-project-id': 'vercelProjectId',
    '--clear-stripe-subscription-id': 'stripeSubscriptionId',
    '--clear-canonical': 'canonical',
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      console.log(
        [
          'Usage:',
          '  npm run repair-portal',
          '  npm run repair-portal -- --email <email> --slug <slug> [field flags] [--apply]',
          '',
          'Field flags:',
          '  --airtable-base-id <id>       --clear-airtable-base-id',
          '  --vercel-project-id <id>      --clear-vercel-project-id',
          '  --stripe-subscription-id <id> --clear-stripe-subscription-id',
          '  --canonical <url>             --clear-canonical',
          `  --status <${STATUSES.join('|')}>`,
          `  --plan <${PLANS.join('|')}>`,
        ].join('\n'),
      );
      process.exit(0);
    } else if (a === '--apply') {
      args.apply = true;
    } else if (a === '--dry-run') {
      args.apply = false;
    } else if (clears[a]) {
      args.set[clears[a]] = null;
    } else if (takesValue[a]) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) fail(`${a} needs a value`);
      const key = takesValue[a];
      if (key === 'email' || key === 'slug') args[key] = v;
      else args.set[key] = v;
      i++;
    } else {
      fail(`unknown argument "${a}" (try --help)`);
    }
  }

  if (args.set.plan && !PLANS.includes(args.set.plan)) {
    fail(`--plan must be one of ${PLANS.join(', ')}`);
  }
  if (args.set.status && !STATUSES.includes(args.set.status)) {
    fail(`--status must be one of ${STATUSES.join(', ')}`);
  }
  return args;
}

function show(v) {
  if (v === null) return 'null';
  if (v === undefined) return '—';
  return String(v);
}

/**
 * The portal's own verdict on a site, so this tool and the client's dashboard can never
 * disagree about what counts as broken.
 */
function describeSite(site) {
  const features = siteFeatures(site);
  const drifting = Object.entries(features)
    .filter(([, a]) => a.state === 'connecting')
    .map(([name]) => name);

  return { features, drifting };
}

function printSite(site, indent = '    ') {
  const { features, drifting } = describeSite(site);
  const flag = drifting.length ? '  ⚠ DRIFT' : '';
  console.log(`${indent}${site.slug}  [${site.plan}/${site.status}]${flag}`);
  console.log(`${indent}  airtableBaseId  ${show(site.airtableBaseId)}`);
  console.log(`${indent}  vercelProjectId ${show(site.vercelProjectId)}`);
  console.log(`${indent}  canonical       ${show(site.canonical)}`);
  console.log(
    `${indent}  features        ` +
      Object.entries(features)
        .map(([k, v]) => `${k}=${v.state}`)
        .join('  '),
  );
  if (drifting.length) {
    console.log(
      `${indent}  → live but not wired for: ${drifting.join(', ')} — the client sees ` +
        `"finishing setup" on ${drifting.length > 1 ? 'those tabs' : 'that tab'}.`,
    );
  }
  return drifting.length;
}

async function audit() {
  const accounts = await listAccounts();
  if (accounts.length === 0) {
    console.log('No account records found.');
    return;
  }

  let drifting = 0;
  for (const account of accounts) {
    console.log(`\n${account.email}`);
    if (!account.sites || account.sites.length === 0) {
      console.log('    (no sites)');
      continue;
    }
    for (const site of account.sites) drifting += printSite(site);
  }

  console.log(
    `\n${accounts.length} account(s). ` +
      (drifting
        ? `${drifting} feature(s) live-but-unwired — repair with:\n` +
          '  npm run repair-portal -- --email <email> --slug <slug> --vercel-project-id <id> --apply'
        : 'No drift: every live site has the ids its enabled features need.'),
  );
}

async function repairOne({ email, slug, set, apply }) {
  const account = await getAccountRecord(email);
  if (!account) fail(`no account record for ${email}`);

  const before = account.sites.find((s) => s.slug === slug);
  if (!before) {
    fail(
      `account ${email} has no site "${slug}" — it has: ` +
        account.sites.map((s) => s.slug).join(', '),
    );
  }

  if (Object.keys(set).length === 0) {
    console.log(`\n${email}`);
    printSite(before);
    console.log('\nNo field flags given — nothing to change. See --help.');
    return;
  }

  // upsertSite owns the merge so this tool cannot invent its own rules.
  const next = upsertSite(account, { slug, ...set });
  const after = next.sites.find((s) => s.slug === slug);

  // Validate before writing rather than after, so a bad edit never reaches KV.
  const parsed = zPortalAccount.safeParse(next);
  if (!parsed.success) {
    console.error('Refusing to write — the result fails schema validation:');
    console.error(parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
    process.exit(1);
  }

  console.log(`\n${email} → ${slug}\n`);
  let changed = 0;
  for (const field of Object.keys(set)) {
    const from = show(before[field]);
    const to = show(after[field]);
    if (from === to) {
      console.log(`  ${field}: ${from} (unchanged)`);
    } else {
      console.log(`  ${field}: ${from}  →  ${to}`);
      changed++;
    }
  }

  console.log('\n  before:');
  printSite(before, '    ');
  console.log('  after:');
  printSite(after, '    ');

  if (changed === 0) {
    console.log('\nNothing would change.');
    return;
  }

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to commit.');
    return;
  }

  await saveAccountRecord(next);
  console.log(`\n✓ Wrote ${changed} field(s) to jdd:account:${account.email}`);
}

async function main() {
  if (!accountStoreConfigured()) {
    fail('KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env');
  }

  const args = parseArgs(process.argv);

  if (!args.email && !args.slug) {
    await audit();
    return;
  }
  if (!args.email || !args.slug) fail('--email and --slug must be given together');

  await repairOne(args);
}

main().catch((err) => {
  console.error('repair-portal-sites: unhandled error');
  console.error(err);
  process.exit(1);
});
