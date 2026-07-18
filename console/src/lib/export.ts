// Server-only helpers for the studio export flow: copy the blank template repo into
// clients/<slug>/repo, drop selected catalog components in, and wire them into page.tsx.
//
// These run inside the console app's /api/build/* routes. The jdd-ops root (which holds
// template/ and clients/) is found by walking up from cwd via findOpsRoot().
import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import type { SiteContent, IntakeEnvelope } from '@jdd/schema';
import { SITE_TYPES_SOURCE } from '@jdd/schema';
import { CONTENT } from '@/data/site';
import { basename, resolve } from 'node:path';
import { findOpsRoot } from '@/lib/opsRoot';
import { isValidSkin, supportsSkin } from '@/lib/skins';

const EXCLUDE = new Set(['node_modules', '.next', '.git', 'out']);

// Allowlist of category -> component file names. Mirrors /api/source's ALLOWED and the
// catalog registry in app/page.tsx; guards against path traversal via untrusted input.
export const CATALOG: Record<string, readonly string[]> = {
  nav:          ['NavMinimal', 'NavCentered', 'NavAnnouncementBar', 'NavSplitCta', 'NavEmergencyBar'],
  hero:         ['HeroSplit', 'HeroCentered', 'HeroSlideshow', 'HeroFormFocus', 'HeroOverlap', 'HeroKinetic'],
  trust:        ['TrustMarquee', 'TrustBadges', 'TrustLogoGrid', 'TrustBar', 'TrustLicenseInsurance', 'TrustReviewsAggregate'],
  about:        ['AboutPillars', 'AboutFeature', 'AboutStatBand', 'AboutStory'],
  services:     ['ServicesGrid', 'ServicesAccordion', 'ServicesPanel', 'ServicesShowcase', 'ServicesSpotlight'],
  work:         ['WorkCarousel', 'WorkGrid', 'WorkSpotlight', 'WorkMasonry'],
  faq:          ['FaqAccordion', 'FaqTwoColumn', 'FaqStickyAside', 'FaqCentered'],
  testimonials: ['TestimonialsGrid', 'TestimonialsCarousel', 'TestimonialsRotator', 'TestimonialsMarquee'],
  finalCta:     ['FinalCtaBanner', 'FinalCtaSimple', 'FinalCtaSplit', 'FinalCtaGradient', 'FinalCtaQuote'],
  contact:      ['ContactSplit', 'CtaBanner', 'ContactCardOverlap', 'ContactInlineStrip'],
  footer:       ['FooterColumns', 'FooterMinimal', 'FooterBrandCta', 'FooterMega'],
  seo:          ['SeoDefault', 'SeoLocalBusiness'],
};

// Categories that map to a JSX body slot in page.tsx (everything except seo, which is
// wired as a generateMetadata re-export instead of a rendered element).
const BODY_SLOTS = ['nav', 'hero', 'trust', 'about', 'services', 'work', 'testimonials', 'faq', 'finalCta', 'contact', 'footer'];

export type Entry = { categoryId: string; name: string; label?: string; skin?: string };

export function resolveRepoRoot(): string {
  const root = findOpsRoot();
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
    if (e.skin && !isValidSkin(e.name, e.skin)) {
      throw new Error(`Unknown skin "${e.skin}" for component "${e.name}".`);
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

/** Stable order with nav pinned first and footer pinned last, others left as-is. */
function orderBodyEntries(entries: Entry[]): Entry[] {
  const nav = entries.filter((e) => e.categoryId === 'nav');
  const footer = entries.filter((e) => e.categoryId === 'footer');
  const middle = entries.filter((e) => e.categoryId !== 'nav' && e.categoryId !== 'footer');
  return [...nav, ...middle, ...footer];
}

/**
 * Derive the client repo's page.tsx from the PRISTINE template page.tsx (so re-running is
 * idempotent), injecting component imports + the SEO generateMetadata re-export, and
 * replacing the @studio:body region with the selected components IN THE GIVEN ORDER.
 * Unselected categories are omitted entirely (WYSIWYG). The order of `entries` is the
 * page order; nav/footer are pinned as a server-side guard.
 */
export function wirePage(repoRoot: string, slug: string, entries: Entry[]): void {
  const templatePage = resolve(repoRoot, 'template', 'src', 'app', 'page.tsx');
  let src = readFileSync(templatePage, 'utf8');

  const bodyEntries = orderBodyEntries(entries.filter((e) => BODY_SLOTS.includes(e.categoryId)));
  const seoEntry = entries.find((e) => e.categoryId === 'seo');

  // 1. Inject component imports under the `// @studio:imports` anchor (in page order).
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

  // 3. Replace the whole body region with the selected components in order. The markers
  //    are kept so the result stays re-wireable on a later export. The chosen skin is baked
  //    in as a literal prop ONLY for components that declare one (supportsSkin) — every other
  //    component's props type has no `skin` field, so emitting it there would fail the client
  //    repo's TypeScript build on an excess/unknown prop.
  const body = bodyEntries
    .map((e) => `      <${e.name}${e.skin && supportsSkin(e.name) ? ` skin="${e.skin}"` : ''} />`)
    .join('\n');
  const bodyRegion = /\{\/\* @studio:body:start \*\/\}[\s\S]*?\{\/\* @studio:body:end \*\/\}/;
  src = src.replace(
    bodyRegion,
    `{/* @studio:body:start */}\n${body}\n      {/* @studio:body:end */}`,
  );

  // 4. The wired page renders components (each imports its own CONTENT), so the page's
  //    own top-level CONTENT import is now unused — drop it to avoid a build error.
  //    `\r?\n` tolerates the template's CRLF line endings (Windows-authored file).
  src = src.replace(/^import \{ CONTENT \} from '@\/data\/site';\r?\n/m, '');

  writeFileSync(resolve(repoDirFor(repoRoot, slug), 'src', 'app', 'page.tsx'), src, 'utf8');
}

/**
 * Copy the preview's v2.1 site.ts into the client repo, overwriting the
 * template's minimal placeholder schema so exported repos build with rich data.
 */
export function copySiteData(repoRoot: string, slug: string): void {
  // Fallback path (no edited content, no vertical preset): seed the client repo with the
  // studio's preview CONTENT. Routed through writeSiteContent so the output is self-contained
  // (inlines SITE_TYPES_SOURCE) — the console's own site.ts now only re-exports @jdd/schema
  // types and must never be copied verbatim into a client repo.
  writeSiteContent(repoRoot, slug, CONTENT);
}

/**
 * Write a SiteContent object as the client repo's site.ts. Inlines the canonical SiteContent
 * interface text (SITE_TYPES_SOURCE from @jdd/schema) ahead of the serialized CONTENT so the
 * generated repo defines its own local type and needs no @jdd/schema dependency on its own
 * Vercel deploy. JSON.stringify makes this data-only (no code injection from edits).
 */
export function writeSiteContent(repoRoot: string, slug: string, content: SiteContent): void {
  const output = `${SITE_TYPES_SOURCE}\nexport const CONTENT: SiteContent = ${JSON.stringify(content, null, 2)};\n`;
  const dest = resolve(repoDirFor(repoRoot, slug), 'src', 'data', 'site.ts');
  writeFileSync(dest, output, 'utf8');
}

/** @deprecated Use writeSiteContent. Kept as a thin alias for the vertical-preset path. */
export function writeVerticalSiteTs(repoRoot: string, slug: string, verticalContent: SiteContent): void {
  writeSiteContent(repoRoot, slug, verticalContent);
}

/** The intake envelope onboard.js consumes: `export const INTAKE = { plan, siteCount, sites }`.
 *  Canonical definition lives in @jdd/schema; re-exported here for existing import paths. */
export type { IntakeEnvelope };

/**
 * Write an intake envelope to clients/<slug>/site.ts as `export const INTAKE`.
 *
 * This is the console's first writer at the CLIENT-FOLDER level (all other writers here
 * target clients/<slug>/repo). onboard.js's loadIntake prefers the `INTAKE` export, so a
 * signup pulled from the queue lands as the exact schema the orchestrator reads next.
 *
 * The agency site's Intake and the studio's SiteContent are the same schema family, so the
 * object is serialized verbatim — no field mapping. Per CLAUDE.md we never invent values:
 * `_meta.missing_fields` is preserved as-is for human review in the wizard's intake step.
 * JSON.stringify keeps this data-only (no code injection from client-supplied strings).
 */
export function writeClientIntake(repoRoot: string, slug: string, intake: IntakeEnvelope): void {
  if (!isValidSlug(slug)) throw new Error(`Invalid slug "${slug}".`);
  const clientDir = resolve(repoRoot, 'clients', slug);
  mkdirSync(clientDir, { recursive: true });
  const header =
    '// Client intake — generated from an agency-site signup pulled off the KV queue.\n' +
    '// Source of truth for onboard.js (npm run onboard -- --schema clients/' + slug + '/site.ts).\n\n';
  const output = `${header}export const INTAKE = ${JSON.stringify(intake, null, 2)};\n`;
  writeFileSync(resolve(clientDir, 'site.ts'), output, 'utf8');
}

/**
 * Walk the content tree; for every string value shaped "upload://<file>", copy the staged
 * file from console/.uploads into clients/<slug>/repo/public/images and rewrite the value to
 * "/images/<file>". Returns a deep clone with refs resolved; unknown refs collapse to "".
 */
export function resolveUploads(repoRoot: string, slug: string, content: SiteContent): SiteContent {
  const stageDir = resolve(process.cwd(), '.uploads');
  const publicImg = resolve(repoDirFor(repoRoot, slug), 'public', 'images');
  let created = false;

  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      if (!v.startsWith('upload://')) return v;
      const file = v.slice('upload://'.length);
      const src = resolve(stageDir, file);
      if (!existsSync(src)) return '';
      if (!created) {
        mkdirSync(publicImg, { recursive: true });
        created = true;
      }
      copyFileSync(src, resolve(publicImg, file));
      return `/images/${file}`;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(content) as SiteContent;
}
