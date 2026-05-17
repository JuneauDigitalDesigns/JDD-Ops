#!/usr/bin/env node
/**
 * scripts/teardown.js — delete every resource provisioned for a test client.
 *
 * SAFETY: refuses to run unless the slug starts with `_e2e-`. This is only
 * intended for disposable test clients. Real client teardown should be a
 * separate, deliberate, manual process.
 *
 * Usage:
 *   npm run teardown -- --slug _e2e-{name}
 *   npm run teardown -- --slug _e2e-{name} --yes    # skip confirmation prompt
 */

import 'dotenv/config';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Octokit } from '@octokit/rest';
import twilio from 'twilio';

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

function parseEnvLocal(envPath) {
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function discoverSites(clientDir, baseSlug) {
  // Single-site (Starter/Growth): clientDir contains .env.local directly.
  // Multi-site (Enterprise): clientDir contains site-1/, site-2/, ... each with .env.local.
  if (existsSync(resolve(clientDir, '.env.local'))) {
    return [{ slug: baseSlug, dir: clientDir, env: parseEnvLocal(resolve(clientDir, '.env.local')) }];
  }
  const sites = [];
  for (const entry of readdirSync(clientDir)) {
    const sub = resolve(clientDir, entry);
    if (!statSync(sub).isDirectory()) continue;
    if (!/^site-\d+$/.test(entry)) continue;
    const env = parseEnvLocal(resolve(sub, '.env.local'));
    const i = parseInt(entry.replace('site-', ''), 10);
    sites.push({ slug: `${baseSlug}-${i}`, dir: sub, env });
  }
  return sites;
}

async function deleteGitHubRepo(octokit, owner, repo) {
  try {
    await octokit.repos.delete({ owner, repo });
    console.log(`  ✓ GitHub repo ${owner}/${repo} deleted`);
  } catch (err) {
    if (err.status === 404) {
      console.log(`  · GitHub repo ${owner}/${repo} not found (skipping)`);
    } else {
      console.error(`  ✗ GitHub delete failed for ${owner}/${repo}: ${err.status} ${err.message}`);
    }
  }
}

async function releaseTwilioNumber(twilioClient, phoneNumber) {
  if (!phoneNumber) {
    console.log('  · No TWILIO_NUMBER recorded (skipping)');
    return;
  }
  try {
    const matches = await twilioClient.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
    if (!matches.length) {
      console.log(`  · Twilio number ${phoneNumber} not owned (skipping)`);
      return;
    }
    await twilioClient.incomingPhoneNumbers(matches[0].sid).remove();
    console.log(`  ✓ Twilio number ${phoneNumber} released`);
  } catch (err) {
    console.error(`  ✗ Twilio release failed for ${phoneNumber}: ${err.message}`);
  }
}

async function deleteRetellAgent(agentId) {
  if (!agentId) {
    console.log('  · No RETELL_AGENT_ID recorded (skipping)');
    return;
  }
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    console.log('  · RETELL_API_KEY not set (skipping Retell delete)');
    return;
  }
  try {
    const res = await fetch(`https://api.retellai.com/delete-agent/${agentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok || res.status === 404) {
      console.log(`  ✓ Retell agent ${agentId} deleted`);
    } else {
      console.error(`  ✗ Retell delete failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`  ✗ Retell delete threw: ${err.message}`);
  }
}

async function deleteVercelProject(slug) {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.log('  · VERCEL_TOKEN not set (skipping Vercel delete)');
    return;
  }
  const teamId = process.env.VERCEL_TEAM_ID;
  const sep = '?';
  const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(slug)}${teamId ? `${sep}teamId=${encodeURIComponent(teamId)}` : ''}`;
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok || res.status === 404) {
      console.log(`  ✓ Vercel project "${slug}" deleted`);
    } else {
      console.error(`  ✗ Vercel delete failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`  ✗ Vercel delete threw: ${err.message}`);
  }
}

async function deleteAirtableBase(baseId) {
  if (!baseId) return;
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    console.log('  · AIRTABLE_API_KEY not set (skipping Airtable delete)');
    return;
  }
  try {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok || res.status === 404) {
      console.log(`  ✓ Airtable base ${baseId} deleted`);
    } else {
      console.error(`  ✗ Airtable delete failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`  ✗ Airtable delete threw: ${err.message}`);
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
    fail(`Refusing to tear down "${slug}" — slug must start with "_e2e-" for safety.`);
  }
  const clientDir = resolve('clients', slug);
  if (!existsSync(clientDir)) fail(`Client directory not found: ${clientDir}`);

  const sites = discoverSites(clientDir, slug);
  if (!sites.length) fail(`No site folders or .env.local found under ${clientDir}`);

  console.log(`\nAbout to delete the following for slug "${slug}":`);
  for (const s of sites) {
    console.log(`  - GitHub repo:   ${process.env.GITHUB_ORG ?? '<GITHUB_ORG>'}/${s.slug}`);
    console.log(`  - Vercel project: ${s.slug}`);
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

  const githubOrg = process.env.GITHUB_ORG;
  const githubToken = process.env.GITHUB_TOKEN;
  const octokit = githubToken ? new Octokit({ auth: githubToken }) : null;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioClient = twilioSid && twilioToken ? twilio(twilioSid, twilioToken) : null;

  for (const s of sites) {
    console.log(`\n--- Tearing down ${s.slug} ---`);
    if (octokit && githubOrg) {
      await deleteGitHubRepo(octokit, githubOrg, s.slug);
    }
    await deleteVercelProject(s.slug);
    if (twilioClient) {
      await releaseTwilioNumber(twilioClient, s.env.TWILIO_NUMBER);
    }
    await deleteRetellAgent(s.env.RETELL_AGENT_ID);
  }

  if (sharedBase) {
    console.log(`\n--- Deleting shared Airtable base ---`);
    await deleteAirtableBase(sharedBase);
  }

  console.log(`\n--- Removing local folder ${clientDir} ---`);
  rmSync(clientDir, { recursive: true, force: true });
  console.log(`✓ Teardown complete for "${slug}"`);
}

main().catch((err) => fail('unhandled error', err));
