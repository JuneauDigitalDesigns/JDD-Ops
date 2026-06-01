#!/usr/bin/env node
/**
 * new-client.js — start a local client site from the blank-slate template.
 *
 * Usage: npm run new-client -- --slug {slug} [--force]
 *
 * Copies template/ → clients/{slug}/repo/ (skipping node_modules/.next/.git) and,
 * if absent, scaffolds clients/{slug}/site.ts (the intake onboard.js reads). Then
 * you drop in catalog components, `cd clients/{slug}/repo && npm install && npm run
 * dev` to preview, and finally `npm run onboard -- --schema clients/{slug}/site.ts`.
 */
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';

function parseArgs(argv) {
  const args = { slug: null, force: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--slug' && argv[i + 1]) args.slug = argv[++i];
    else if (argv[i] === '--force') args.force = true;
  }
  return args;
}

const EXCLUDE = new Set(['node_modules', '.next', '.git', 'out']);

function starterIntake(slug) {
  return `// Intake for "${slug}" — the data source onboard.js reads + splices.
// Fill in real values; clear _meta.missing_fields as you go. Never invent values.
export const INTAKE = {
  plan: "starter",
  siteCount: 1,
  sites: [
    {
      brand: {
        name: "TODO",
        short: "${slug}",
        long: "TODO",
        established: null,
        tagline: "TODO",
        phone: "TODO",
        phoneHref: "tel:+1",
        email: "TODO",
        address: "TODO",
        license: null,
        palette: {
          accent: "#1E6FBF",
          bg: "#FFFFFF",
          bgSoft: "#F0F5FB",
          ink: "#0F1B2D",
          inkSoft: "#4A5568",
          rule: "#CBD5E1",
        },
        typography: {
          fontSans: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontHeading: "-apple-system, BlinkMacSystemFont, sans-serif",
          headingWeight: 700,
          bodyWeight: 400,
        },
      },
      services: { items: [] },
      faq: { items: [] },
      seo: { title: "TODO", description: "TODO", canonical: "https://example.com" },
      _meta: {
        schema_version: "2.1",
        generated_at: "${new Date().toISOString()}",
        variation: "D",
        is_placeholder: true,
        missing_fields: ["brand.name", "brand.long", "brand.tagline", "brand.phone", "brand.email", "brand.address", "services.items", "faq.items", "seo.title", "seo.description"],
        selectedPlan: "starter",
      },
    },
  ],
};
`;
}

function main() {
  const { slug, force } = parseArgs(process.argv);
  if (!slug) {
    console.error('Missing --slug. Usage: npm run new-client -- --slug {slug}');
    process.exit(1);
  }

  const root = process.cwd();
  const templateDir = resolve(root, 'template');
  if (!existsSync(templateDir)) {
    console.error(`Template not found at ${templateDir}`);
    process.exit(1);
  }

  const clientDir = resolve(root, 'clients', slug);
  const repoDir = resolve(clientDir, 'repo');
  if (existsSync(repoDir) && !force) {
    console.error(`${repoDir} already exists. Re-run with --force to overwrite.`);
    process.exit(1);
  }

  mkdirSync(clientDir, { recursive: true });
  cpSync(templateDir, repoDir, {
    recursive: true,
    force: true,
    filter: (src) => !EXCLUDE.has(basename(src)),
  });
  console.log(`  Copied template/ → ${repoDir}`);

  const intakePath = resolve(clientDir, 'site.ts');
  if (!existsSync(intakePath)) {
    writeFileSync(intakePath, starterIntake(slug), 'utf8');
    console.log(`  Scaffolded intake → ${intakePath}`);
  } else {
    console.log(`  Intake already exists → ${intakePath} (left as-is)`);
  }

  console.log('\nNext:');
  console.log(`  1. Fill in clients/${slug}/site.ts (the intake).`);
  console.log(`  2. Drop catalog components into clients/${slug}/repo/src/components/catalog/ and wire the SLOTs in src/app/page.tsx.`);
  console.log(`  3. (cd clients/${slug}/repo && npm install && npm run dev) to preview.`);
  console.log(`  4. npm run hydrate -- --slug ${slug}   # splice intake content for an accurate preview`);
  console.log(`  5. npm run onboard -- --schema clients/${slug}/site.ts`);
}

main();
