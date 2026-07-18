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
 */

import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { syncEnvToVercel } from '../lib/vercel-sync.js';

function fail(msg, err) {
  console.error(`sync-vercel-env: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { slug: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--slug' && argv[i + 1]) {
      args.slug = argv[i + 1];
      i++;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: npm run sync-env -- --slug <slug>');
      process.exit(0);
    }
  }
  return args;
}

// Try to recover the brand name from clients/{slug}/site.ts so we can also
// inject NEXT_PUBLIC_BRAND_NAME. Falls back to slug if unavailable.
async function readBrandName(slug) {
  const schemaPath = resolve('clients', slug, 'site.ts');
  if (!existsSync(schemaPath)) return slug;
  try {
    const src = readFileSync(schemaPath, 'utf8');
    const stripped = src
      .replace(/:\s*SiteContent/g, '')
      .replace(/^import .*$/gm, '')
      .replace(/^export type .*?;$/gms, '');
    const dataUrl = 'data:text/javascript;base64,' + Buffer.from(stripped).toString('base64');
    const mod = await import(dataUrl);
    return mod?.CONTENT?.brand?.name || slug;
  } catch {
    return slug;
  }
}

async function main() {
  const { slug } = parseArgs(process.argv);
  if (!slug) fail('Missing --slug <slug>. Usage: npm run sync-env -- --slug <slug>');

  const clientDir = resolve('clients', slug);
  if (!existsSync(clientDir)) fail(`Client directory not found: ${clientDir}`);

  console.log(`Syncing env vars for "${slug}" → Vercel\n`);
  const brandName = await readBrandName(slug);
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

main().catch((err) => fail('unhandled error', err));
