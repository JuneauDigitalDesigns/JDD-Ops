#!/usr/bin/env node
/**
 * scripts/repair-call-log.js — add the Call Log columns a client's Airtable base is missing.
 *
 * Usage:
 *   npm run repair-call-log -- --slug <slug>                 # preview: what's missing, nothing written
 *   npm run repair-call-log -- --slug <slug> --write         # add them, then read back and re-check
 *   npm run repair-call-log -- --slug <slug> --site 2 ...    # an enterprise site
 *
 * Bases provisioned before 2026-11-02 have no `SMS consent` column. Every call's consent answer is
 * then dropped, and onboard.js's `airtable.schemaCovers` refuses to re-run the client. This adds
 * each CALL_LOG_FIELDS column the table lacks, exactly as onboard.js would have created it
 * (`SMS consent` with lowercase granted/declined/unknown). ADDITIVE ONLY: it never modifies or
 * removes an existing column or row. The same repair is the console's "Add …" button on the
 * `airtable.missingColumns` finding.
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { repairAirtableBase } from '../lib/repair-ops.js';
import { missingCallLogFields } from '../lib/call-log-fields.js';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : null;
};
const die = (msg) => {
  console.error(`repair-call-log: ${msg}`);
  process.exit(1);
};

const slug = arg('slug');
if (!slug) die('Missing --slug <slug>');
const write = process.argv.includes('--write');
const clientDir = arg('site') ? resolve('clients', slug, `site-${arg('site')}`) : resolve('clients', slug);
const envPath = resolve(clientDir, '.env.local');
if (!existsSync(envPath)) die(`No ${envPath}`);
const baseId = /^AIRTABLE_BASE_ID=(.*)$/m.exec(readFileSync(envPath, 'utf8'))?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!baseId) die(`No AIRTABLE_BASE_ID in ${envPath}`);
const apiKey = process.env.AIRTABLE_API_KEY;
if (!apiKey) die('AIRTABLE_API_KEY not set in .env');

async function readMissing() {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) die(`Airtable list-tables returned ${res.status}`);
  const callLog = ((await res.json())?.tables ?? []).find((t) => t.name === 'Call Log');
  if (!callLog) die(`Base ${baseId} has no Call Log table — that is a different repair (console: "Create the Call Log table").`);
  return missingCallLogFields(callLog);
}

const missing = await readMissing();
console.log(`${slug}${arg('site') ? ` site-${arg('site')}` : ''} — base ${baseId}`);
if (!missing.length) {
  console.log('✓ Call Log has every column. Nothing to do.');
  process.exit(0);
}
for (const f of missing) {
  const choices = f.options?.choices ? ` (${f.options.choices.map((c) => c.name).join(' / ')})` : '';
  console.log(`  missing: "${f.name}" — ${f.type}${choices}`);
}
if (!write) {
  console.log('\nPreview only. Re-run with --write to add them. Existing columns and rows are not touched.');
  process.exit(0);
}

const result = await repairAirtableBase({ apiKey, baseId, want: 'columns' });
if (!result.ok) die(result.reason);
console.log(`✓ ${result.reason}`);

const after = await readMissing();
if (after.length) die(`read back: still missing ${after.map((f) => f.name).join(', ')}`);
console.log('✓ Read back: Call Log has every column.');
