#!/usr/bin/env node
/**
 * Keep the Firecrawl extraction schema + mapper in sync across the three repos.
 *
 * Canonical:  templates/business-site-template/business-template/src/data/firecrawl-schema.ts
 * Copies:     ops/jdd-ops/studio/preview/src/data/firecrawl-schema.ts
 *             ops/juneau-digital-designs/app/lib/firecrawl-schema.ts
 *
 * Usage (from studio/preview):
 *   node scripts/sync-schema.mjs          # copy canonical → both copies
 *   node scripts/sync-schema.mjs --check  # exit 1 if any copy has drifted (CI / lint guard)
 *
 * The schema module is intentionally self-contained (no cross-file imports) so
 * the copies are byte-identical and this guard can do a plain text comparison.
 * Architected so additional files (e.g. site.ts) can be added to PAIRS later if
 * full SiteContent unification is pursued.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const previewRoot = resolve(scriptDir, '..');
const desktop = resolve(previewRoot, '..', '..', '..', '..');

const CANONICAL = resolve(
  desktop,
  'templates/business-site-template/business-template/src/data/firecrawl-schema.ts',
);

const COPIES = [
  resolve(previewRoot, 'src/data/firecrawl-schema.ts'),
  resolve(desktop, 'ops/juneau-digital-designs/app/lib/firecrawl-schema.ts'),
];

const check = process.argv.includes('--check');

if (!existsSync(CANONICAL)) {
  console.error(`✖ Canonical schema not found:\n  ${CANONICAL}`);
  process.exit(1);
}

const canonical = readFileSync(CANONICAL, 'utf8');
let drift = 0;

for (const copy of COPIES) {
  const exists = existsSync(copy);
  const current = exists ? readFileSync(copy, 'utf8') : null;
  const inSync = current === canonical;

  if (check) {
    if (!inSync) {
      drift++;
      console.error(`✖ Out of sync: ${copy}${exists ? '' : '  (missing)'}`);
    } else {
      console.log(`✓ In sync:    ${copy}`);
    }
  } else if (!inSync) {
    writeFileSync(copy, canonical, 'utf8');
    console.log(`→ Synced:     ${copy}`);
  } else {
    console.log(`✓ Unchanged:  ${copy}`);
  }
}

if (check && drift > 0) {
  console.error(
    `\n${drift} copy(ies) drifted from canonical firecrawl-schema.ts.\n` +
      `Run \`npm run sync-schema\` from studio/preview to fix.`,
  );
  process.exit(1);
}

if (!check) console.log('\nSchema sync complete.');
