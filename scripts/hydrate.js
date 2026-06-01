#!/usr/bin/env node
/**
 * hydrate.js — splice a client's real content into the LOCAL repo for preview.
 *
 * Usage: npm run hydrate -- --slug {slug} [--site N]
 *
 * Reads clients/{slug}/site.ts (the intake) and writes its first (or Nth) site's
 * content into clients/{slug}/repo/src/data/site.ts, using the SAME marker splice
 * onboard.js step 3 performs. Pure local, no network — so `npm run dev` shows real
 * copy before onboarding. onboard.js re-splices at provision time regardless.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MARKER = 'export const CONTENT: SiteContent = ';

function parseArgs(argv) {
  const args = { slug: null, site: 0 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--slug' && argv[i + 1]) args.slug = argv[++i];
    else if (argv[i] === '--site' && argv[i + 1]) args.site = parseInt(argv[++i], 10);
  }
  return args;
}

// Mirrors onboard.js loadIntake: strip TS-only syntax, import as a data URL.
async function loadIntake(schemaPath) {
  const src = readFileSync(schemaPath, 'utf8');
  const stripped = src
    .replace(/:\s*SiteContent/g, '')
    .replace(/:\s*Intake/g, '')
    .replace(/^import .*$/gm, '')
    .replace(/^export type .*?;$/gms, '');
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(stripped).toString('base64');
  const mod = await import(dataUrl);
  if (mod.INTAKE) return mod.INTAKE;
  if (mod.CONTENT) return { sites: [mod.CONTENT] };
  throw new Error('Schema must export INTAKE or CONTENT');
}

// Mirrors onboard.js writeClientSchema: keep everything before the marker.
function spliceContent(siteFile, content) {
  if (!existsSync(siteFile)) throw new Error(`Expected ${siteFile} in the local repo`);
  const original = readFileSync(siteFile, 'utf8');
  const idx = original.indexOf(MARKER);
  if (idx === -1) throw new Error(`Could not find marker in ${siteFile} — refusing to overwrite blindly`);
  const typePrefix = original.slice(0, idx);
  const serialized = JSON.stringify(content, null, 2);
  writeFileSync(siteFile, `${typePrefix}${MARKER}${serialized};\n`, 'utf8');
}

async function main() {
  const { slug, site } = parseArgs(process.argv);
  if (!slug) {
    console.error('Missing --slug. Usage: npm run hydrate -- --slug {slug}');
    process.exit(1);
  }
  const root = process.cwd();
  const schemaPath = resolve(root, 'clients', slug, 'site.ts');
  const siteFile = resolve(root, 'clients', slug, 'repo', 'src', 'data', 'site.ts');

  if (!existsSync(schemaPath)) {
    console.error(`Intake not found: ${schemaPath}`);
    process.exit(1);
  }

  const intake = await loadIntake(schemaPath);
  const content = intake.sites?.[site];
  if (!content) {
    console.error(`No site at index ${site} in ${schemaPath}`);
    process.exit(1);
  }

  spliceContent(siteFile, content);
  console.log(`  Hydrated ${siteFile} with ${slug} site ${site} content.`);
  console.log(`  Preview: (cd clients/${slug}/repo && npm run dev)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
