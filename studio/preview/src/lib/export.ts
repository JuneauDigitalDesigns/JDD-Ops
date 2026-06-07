// Server-only helpers for the studio export flow: copy the blank template repo into
// clients/<slug>/repo, drop selected catalog components in, and wire them into page.tsx.
//
// These run inside the preview app's API routes. process.cwd() is studio/preview, so the
// repo root (which holds template/ and clients/) is two levels up.
import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, resolve } from 'node:path';

const EXCLUDE = new Set(['node_modules', '.next', '.git', 'out']);

// Allowlist of category -> component file names. Mirrors /api/source's ALLOWED and the
// catalog registry in app/page.tsx; guards against path traversal via untrusted input.
export const CATALOG: Record<string, readonly string[]> = {
  nav:          ['NavMinimal', 'NavCentered', 'NavAnnouncementBar', 'NavSplitCta'],
  hero:         ['HeroSplit', 'HeroCentered', 'HeroSlideshow', 'HeroFormFocus'],
  trust:        ['TrustMarquee', 'TrustBadges', 'TrustLogoGrid', 'TrustBar'],
  about:        ['AboutPillars', 'AboutFeature', 'AboutStatBand', 'AboutStory'],
  services:     ['ServicesGrid', 'ServicesAccordion', 'ServicesPanel', 'ServicesShowcase'],
  work:         ['WorkCarousel', 'WorkGrid', 'WorkSpotlight', 'WorkMasonry'],
  faq:          ['FaqAccordion', 'FaqTwoColumn', 'FaqStickyAside', 'FaqCentered'],
  testimonials: ['TestimonialsGrid', 'TestimonialsCarousel', 'TestimonialsRotator', 'TestimonialsMarquee'],
  finalCta:     ['FinalCtaBanner', 'FinalCtaSimple', 'FinalCtaSplit', 'FinalCtaGradient'],
  contact:      ['ContactSplit', 'CtaBanner', 'ContactCardOverlap', 'ContactInlineStrip'],
  footer:       ['FooterColumns', 'FooterMinimal', 'FooterBrandCta', 'FooterMega'],
  seo:          ['SeoDefault', 'SeoLocalBusiness'],
};

// Categories that map to a JSX body slot in page.tsx (everything except seo, which is
// wired as a generateMetadata re-export instead of a rendered element).
const BODY_SLOTS = ['nav', 'hero', 'trust', 'about', 'services', 'work', 'testimonials', 'faq', 'finalCta', 'contact', 'footer'];

export type Entry = { categoryId: string; name: string; label?: string };

export function resolveRepoRoot(): string {
  const root = resolve(process.cwd(), '..', '..');
  const tplPkg = resolve(root, 'template', 'package.json');
  if (!existsSync(tplPkg)) {
    throw new Error(`Template not found at ${resolve(root, 'template')} (cwd=${process.cwd()}).`);
  }
  const pkg = JSON.parse(readFileSync(tplPkg, 'utf8')) as { name?: string };
  if (pkg.name !== 'business-site-template') {
    throw new Error(`Unexpected template package "${pkg.name}" at ${tplPkg}.`);
  }
  return root;
}

export function isValidSlug(slug: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(slug);
}

export function repoDirFor(repoRoot: string, slug: string): string {
  return resolve(repoRoot, 'clients', slug, 'repo');
}

/** Existing client slugs (directories under clients/, dotfiles skipped). */
export function listClients(repoRoot: string): string[] {
  const clientsDir = resolve(repoRoot, 'clients');
  if (!existsSync(clientsDir)) return [];
  return readdirSync(clientsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();
}

/** True if clients/<slug>/repo already exists. */
export function repoExists(repoRoot: string, slug: string): boolean {
  return existsSync(repoDirFor(repoRoot, slug));
}

/** Validate selections; throws on anything not in the allowlist. Returns clean entries. */
export function validateEntries(entries: Entry[]): Entry[] {
  if (!entries.length) throw new Error('No components selected to export.');
  for (const e of entries) {
    const allowed = CATALOG[e.categoryId];
    if (!allowed) throw new Error(`Unknown category "${e.categoryId}".`);
    if (!allowed.includes(e.name)) {
      throw new Error(`Unknown component "${e.name}" for category "${e.categoryId}".`);
    }
  }
  return entries;
}

/**
 * Copy template/ -> clients/<slug>/repo (skipping node_modules/.next/.git/out).
 * Skips the copy if the repo already exists and overwrite is false.
 * Returns true if a copy happened, false if an existing repo was reused.
 */
export function copyTemplate(
  repoRoot: string,
  slug: string,
  { overwrite }: { overwrite: boolean },
): boolean {
  const templateDir = resolve(repoRoot, 'template');
  const clientDir = resolve(repoRoot, 'clients', slug);
  const repoDir = repoDirFor(repoRoot, slug);

  if (existsSync(repoDir) && !overwrite) return false;

  mkdirSync(clientDir, { recursive: true });
  cpSync(templateDir, repoDir, {
    recursive: true,
    force: true,
    filter: (src) => !EXCLUDE.has(basename(src)),
  });
  return true;
}

/**
 * Copy each selected component's source from the preview catalog into the client repo.
 * Returns the relative repo paths written.
 */
export function placeComponents(repoRoot: string, slug: string, entries: Entry[]): string[] {
  const repoDir = repoDirFor(repoRoot, slug);
  const written: string[] = [];
  for (const e of entries) {
    const srcFile = resolve(process.cwd(), 'src', 'components', 'catalog', e.categoryId, `${e.name}.tsx`);
    if (!existsSync(srcFile)) {
      throw new Error(`Catalog source missing: ${srcFile}`);
    }
    const destDir = resolve(repoDir, 'src', 'components', 'catalog', e.categoryId);
    mkdirSync(destDir, { recursive: true });
    copyFileSync(srcFile, resolve(destDir, `${e.name}.tsx`));
    written.push(`src/components/catalog/${e.categoryId}/${e.name}.tsx`);
  }
  return written;
}

/**
 * Derive the client repo's page.tsx from the PRISTINE template page.tsx (so re-running is
 * idempotent), injecting component imports + slot elements + the SEO generateMetadata
 * re-export based on the selected entries.
 */
export function wirePage(repoRoot: string, slug: string, entries: Entry[]): void {
  const templatePage = resolve(repoRoot, 'template', 'src', 'app', 'page.tsx');
  let src = readFileSync(templatePage, 'utf8');

  const bodyEntries = entries.filter((e) => BODY_SLOTS.includes(e.categoryId));
  const seoEntry = entries.find((e) => e.categoryId === 'seo');

  // 1. Inject component imports under the `// @studio:imports` anchor.
  const importLines = bodyEntries
    .map((e) => `import ${e.name} from '@/components/catalog/${e.categoryId}/${e.name}';`)
    .join('\n');
  if (importLines) {
    src = src.replace('// @studio:imports', `// @studio:imports\n${importLines}`);
  }

  // 2. Inject the SEO generateMetadata re-export under the `// @studio:metadata` anchor.
  if (seoEntry) {
    const line = `export { generateMetadata } from '@/components/catalog/seo/${seoEntry.name}';`;
    src = src.replace('// @studio:metadata', `// @studio:metadata\n${line}`);
  }

  // 3. Replace each selected body slot's placeholder with the component element. Markers
  //    are kept so the result stays re-wireable.
  for (const e of bodyEntries) {
    const startTag = `{/* @studio:slot:${e.categoryId}:start */}`;
    const endTag = `{/* @studio:slot:${e.categoryId}:end */}`;
    const re = new RegExp(
      `${escapeRe(startTag)}[\\s\\S]*?${escapeRe(endTag)}`,
    );
    src = src.replace(re, `${startTag}\n      <${e.name} />\n      ${endTag}`);
  }

  writeFileSync(resolve(repoDirFor(repoRoot, slug), 'src', 'app', 'page.tsx'), src, 'utf8');
}

/**
 * Copy the preview's v2.1 site.ts into the client repo, overwriting the
 * template's minimal placeholder schema so exported repos build with rich data.
 */
export function copySiteData(repoRoot: string, slug: string): void {
  const src = resolve(process.cwd(), 'src', 'data', 'site.ts');
  const dest = resolve(repoDirFor(repoRoot, slug), 'src', 'data', 'site.ts');
  copyFileSync(src, dest);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
