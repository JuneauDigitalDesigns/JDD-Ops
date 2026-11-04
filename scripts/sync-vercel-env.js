#!/usr/bin/env node
/**
 * scripts/sync-vercel-env.js — re-push env vars from clients/{slug}/.env.local
 * to the client's Vercel project.
 *
 * Run after editing clients/{slug}/.env.local (e.g. updating RETELL_* or
 * TWILIO_NUMBER) to re-push the values and trigger a fresh deploy.
 *
 * Usage:
 *   npm run sync-env -- --slug <slug>
 *   npm run sync-env -- --slug <slug> --brand "Your HVAC Co."   # only if site.ts can't be read
 *
 * NEXT_PUBLIC_BRAND_NAME is what the callback's opening line says ("Hi, this is <brand>"). It is
 * read with onboard.js's real loadIntake. This used to strip the TypeScript by regex and, when
 * that threw, silently fall back to the SLUG — so on 2026-11-04 the growth fixture's agent opened
 * a live callback with "Hi, this is _e2e_test_growth". It now refuses rather than guess.
 */

import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { syncEnvToVercel } from '../lib/vercel-sync.js';
import { loadIntake } from '../onboard.js';

function fail(msg, err) {
  console.error(`sync-vercel-env: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { slug: null, brand: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--slug' && argv[i + 1]) {
      args.slug = argv[i + 1];
      i++;
    } else if (argv[i] === '--brand' && argv[i + 1]) {
      args.brand = argv[i + 1];
      i++;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: npm run sync-env -- --slug <slug>');
      process.exit(0);
    }
  }
  return args;
}

/**
 * The business name from a client's site.ts, through onboard.js's own loader — the same one a
 * provisioning run uses, so the two can never disagree. `null` when it can't be read; NEVER the slug.
 */
export async function readBrandName(schemaPath) {
  if (!existsSync(schemaPath)) return null;
  try {
    const intake = await loadIntake(schemaPath);
    const name = intake?.sites?.[0]?.brand?.name;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

async function main() {
  const { slug, brand } = parseArgs(process.argv);
  if (!slug) fail('Missing --slug <slug>. Usage: npm run sync-env -- --slug <slug>');

  const clientDir = resolve('clients', slug);
  if (!existsSync(clientDir)) fail(`Client directory not found: ${clientDir}`);

  console.log(`Syncing env vars for "${slug}" → Vercel\n`);
  const brandName = brand?.trim() || (await readBrandName(resolve('clients', slug, 'site.ts')));
  if (!brandName) {
    fail(`Could not read brand.name from clients/${slug}/site.ts. Pass --brand "<Business Name>" — never the slug, which the agent would say aloud.`);
  }
  console.log(`  NEXT_PUBLIC_BRAND_NAME = "${brandName}"`);
  const result = await syncEnvToVercel({
    slug,
    clientDir,
    extraEnv: { NEXT_PUBLIC_BRAND_NAME: brandName },
  });

  console.log(`\nSummary:`);
  console.log(`  created: ${result.created.length}`);
  console.log(`  updated: ${result.updated.length}`);
  console.log(`  skipped: ${result.skipped.length}`);
  if (result.warnings.length) {
    console.log(`\nWarnings:`);
    for (const w of result.warnings) console.log(`  ⚠ ${w}`);
  }
  if (result.created.length || result.updated.length) {
    console.log(`\n✓ Trigger a redeploy on Vercel for the new env to take effect.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => fail('unhandled error', err));
}
