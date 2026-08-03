#!/usr/bin/env node
/**
 * scripts/teardown.js — delete every resource provisioned for a test client.
 *
 * SAFETY: refuses to run unless the slug starts with `_e2e-`. This is only
 * intended for disposable test clients, and stays that way: a CLI that will
 * destroy a real client with `--yes` is one arrow-up in shell history away from
 * a very bad afternoon.
 *
 * Real-client teardown lives in the console (/manage → Danger), where it gets a
 * preview of exactly what dies, a typed confirmation, an archive record written
 * before anything is destroyed, and cleanup of the things this script never
 * touched (portal record, Clerk user, Retell LLM, Make scenario).
 *
 * The per-resource deletes now live in lib/teardown-ops.js so both this script
 * and the console run the same code. This file is the CLI wrapper: argument
 * parsing, the `_e2e-` gate, the confirmation prompt, and formatting step
 * results back into the log lines it has always printed.
 *
 * Usage:
 *   npm run teardown -- --slug _e2e-{name}
 *   npm run teardown -- --slug _e2e-{name} --yes    # skip confirmation prompt
 */

import 'dotenv/config';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Octokit } from '@octokit/rest';
import twilio from 'twilio';
import { sanitizeProjectName } from '../lib/vercel-sync.js';
import {
  discoverSites,
  deleteGitHubRepo,
  releaseTwilioNumber,
  deleteRetellAgent,
  deleteVercelProject,
  deleteAirtableBase,
} from '../lib/teardown-ops.js';

function fail(msg, err) {
  console.error(`teardown: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { slug: null, yes: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--slug' && argv[i + 1]) {
      args.slug = argv[i + 1];
      i++;
    } else if (argv[i] === '--yes' || argv[i] === '-y') {
      args.yes = true;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: npm run teardown -- --slug _e2e-{name} [--yes]');
      process.exit(0);
    }
  }
  return args;
}

/**
 * Render a StepResult as the line this script has always printed.
 * `✓` deleted · `·` skipped or already gone · `✗` failed.
 */
function report(result, label) {
  const what = `${label}${result.target && result.target !== '—' ? ` ${result.target}` : ''}`;
  switch (result.outcome) {
    case 'deleted':
      console.log(`  ✓ ${what} deleted`);
      break;
    case 'already-gone':
      console.log(`  · ${what} not found (skipping)`);
      break;
    case 'skipped':
      console.log(`  · ${result.message ?? `${what} skipped`}`);
      break;
    default:
      console.error(`  ✗ ${what} failed: ${result.message ?? 'unknown error'}`);
  }
}

async function confirm(message) {
  const rl = createInterface({ input: stdin, output: stdout });
  const ans = (await rl.question(`${message} (yes/no) `)).trim().toLowerCase();
  rl.close();
  return ans === 'yes' || ans === 'y';
}

async function main() {
  const { slug, yes } = parseArgs(process.argv);
  if (!slug) fail('Missing --slug. Usage: npm run teardown -- --slug _e2e-{name}');
  if (!slug.startsWith('_e2e-')) {
    fail(
      `Refusing to tear down "${slug}" — slug must start with "_e2e-" for safety.\n` +
        `        Real clients are torn down from the console: /manage → Danger.`,
    );
  }
  const clientDir = resolve('clients', slug);
  if (!existsSync(clientDir)) fail(`Client directory not found: ${clientDir}`);

  const sites = discoverSites(clientDir, slug);
  if (!sites.length) fail(`No site folders or .env.local found under ${clientDir}`);

  console.log(`\nAbout to delete the following for slug "${slug}":`);
  for (const s of sites) {
    console.log(`  - GitHub repo:   ${process.env.GITHUB_ORG ?? '<GITHUB_ORG>'}/${s.slug}`);
    // Vercel forbids leading underscores etc., so the real project name is the sanitized
    // form onboard.js actually created — not the raw folder slug. Showing the raw slug
    // here previously meant the preview (and the "not found, skipping" log line after it)
    // both silently referred to a project that never existed.
    console.log(`  - Vercel project: ${sanitizeProjectName(s.slug)}`);
    if (s.env.TWILIO_NUMBER) console.log(`  - Twilio number:  ${s.env.TWILIO_NUMBER}`);
    if (s.env.RETELL_AGENT_ID) console.log(`  - Retell agent:   ${s.env.RETELL_AGENT_ID}`);
  }
  const sharedBase = sites.map((s) => s.env.AIRTABLE_BASE_ID).filter(Boolean)[0];
  if (sharedBase) console.log(`  - Airtable base:  ${sharedBase}`);
  console.log(`  - Local folder:   ${clientDir}`);

  if (!yes) {
    const ok = await confirm('\nProceed?');
    if (!ok) {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  const org = process.env.GITHUB_ORG;
  const githubToken = process.env.GITHUB_TOKEN;
  const octokit = githubToken ? new Octokit({ auth: githubToken }) : null;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const client = twilioSid && twilioToken ? twilio(twilioSid, twilioToken) : null;
  const retellKey = process.env.RETELL_API_KEY;

  for (const s of sites) {
    console.log(`\n--- Tearing down ${s.slug} ---`);
    report(await deleteGitHubRepo({ octokit, org, repo: s.slug }), 'GitHub repo');
    report(
      await deleteVercelProject({
        token: process.env.VERCEL_TOKEN,
        teamId: process.env.VERCEL_TEAM_ID,
        slug: s.slug,
      }),
      'Vercel project',
    );
    report(await releaseTwilioNumber({ client, phoneNumber: s.env.TWILIO_NUMBER }), 'Twilio number');
    report(await deleteRetellAgent({ apiKey: retellKey, agentId: s.env.RETELL_AGENT_ID }), 'Retell agent');
  }

  if (sharedBase) {
    console.log(`\n--- Deleting shared Airtable base ---`);
    report(await deleteAirtableBase({ apiKey: process.env.AIRTABLE_API_KEY, baseId: sharedBase }), 'Airtable base');
  }

  console.log(`\n--- Removing local folder ${clientDir} ---`);
  rmSync(clientDir, { recursive: true, force: true });
  console.log(`✓ Teardown complete for "${slug}"`);
}

// Only run when invoked directly. Without this, importing anything from this file
// — a test, an editor auto-import, a mistaken bridge call — would execute a teardown.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => fail('unhandled error', err));
}
