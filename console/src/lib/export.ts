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
  statSync,
  writeFileSync,
} from 'node:fs';
import type { SiteContent, IntakeEnvelope } from '@jdd/schema';
import { SITE_TYPES_SOURCE } from '@jdd/schema';
import { CONTENT } from '@/data/site';
import { basename, dirname, relative, resolve, sep } from 'node:path';
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
 * Repo paths owned by onboard.js (written from jdd-ops/lib/site-routes/*), NOT by template/.
 *
 * template/ ships stubs of all three so it builds standalone, but the contact stub is a retired
 * architecture — it still branches on `LEAD_DELIVERY_MODE === 'webhook'` and posts to
 * MAKE_WEBHOOK_URL, which nothing sets any more. Copying it over a provisioned client swaps a
 * working Retell callback for a webhook that does not exist and leads vanish silently. That had
 * already happened to the reference client before this guard existed.
 */
export const ONBOARD_OWNED = [
  { asset: 'contact.route.ts', dest: 'src/app/api/contact/route.ts' },
  { asset: 'voice.route.ts', dest: 'src/app/api/voice/route.ts' },
  { asset: 'no-answer.route.ts', dest: 'src/app/api/voice/no-answer/route.ts' },
] as const;

/**
 * What the TEMPLATE owns once a repo exists — the shared libraries, styles and build config a
 * catalog component compiles against.
 *
 * Refreshing exactly these is the entire purpose of `overwrite`: verifyCatalogImports' staleRepo
 * branch tells the operator to "export again with overwrite enabled" precisely so src/lib catches
 * up with the console. Everything outside this list belongs to the client repo once it exists.
 */
const TEMPLATE_OWNED_PREFIXES = ['src/lib/', 'src/styles/'];
const TEMPLATE_OWNED_FILES = [
  'next.config.js',
  'postcss.config.js',
  'tailwind.config.ts',
  'tsconfig.json',
  // Rewritten immediately afterwards by writeSiteContent/wirePage; listed so an existing repo
  // still gets a clean base if either of those is ever skipped.
  'src/data/site.ts',
  'src/app/page.tsx',
];

/**
 * template-relative POSIX path for a source path handed to cpSync's filter.
 *
 * cpSync hands the filter Windows extended-length paths (`\\?\C:\…`) whose prefix doesn't match
 * the plain `templateDir` we computed, so a bare `relative()` gives up and returns the ABSOLUTE
 * path — which then matches none of the ownership lists, and every existing file silently falls
 * through to "preserve". That looks like it works (nothing gets clobbered) right up until you
 * notice `overwrite` no longer refreshes src/lib either, which is the one thing it is for.
 * git-state.ts hit the same class of bug in samePath(); normalise the same way.
 *
 * Returns '' when src is the template root or somehow outside it — callers treat that as
 * "no opinion", i.e. copy.
 */
function relPath(templateDir: string, src: string): string {
  const norm = (p: string) => resolve(p).replace(/^\\\\\?\\/, '').split(sep).join('/');
  const base = norm(templateDir);
  const full = norm(src);
  if (!full.toLowerCase().startsWith(base.toLowerCase() + '/')) return '';
  return full.slice(base.length + 1);
}

/**
 * Copy template/ -> clients/<slug>/repo (skipping node_modules/.next/.git/out).
 *
 * FIRST EXPORT (no repo yet): copies everything. This is the provisioning path.
 *
 * EXISTING REPO with `overwrite`: copies only files the template owns, plus files the repo
 * doesn't have yet. A blanket copy is what this used to do, and it silently reverted every file
 * the client repo had legitimately evolved past the template — 20 of them on the reference
 * client, including package.json (dropping the @vercel/speed-insights dependency) and
 * layout.tsx (dropping the <SpeedInsights /> it renders). Worse, the repo-only catalog
 * components survive that copy while package.json is reverted underneath them, so a component
 * needing a dependency the template lacks fails to build with a module-not-found that points
 * nowhere near the cause.
 *
 * Returns whether a copy happened and which owned paths were deliberately left alone.
 */
export function copyTemplate(
  repoRoot: string,
  slug: string,
  { overwrite, preserveOnboardRoutes = true }: { overwrite: boolean; preserveOnboardRoutes?: boolean },
): { copied: boolean; preserved: string[] } {
  const templateDir = resolve(repoRoot, 'template');
  const clientDir = resolve(repoRoot, 'clients', slug);
  const repoDir = repoDirFor(repoRoot, slug);

  const existed = existsSync(repoDir);
  if (existed && !overwrite) return { copied: false, preserved: [] };

  const preserved: string[] = [];
  mkdirSync(clientDir, { recursive: true });
  cpSync(templateDir, repoDir, {
    recursive: true,
    force: true,
    filter: (src) => {
      if (EXCLUDE.has(basename(src))) return false;
      if (!existed) return true; // first export: the template IS the repo

      const rel = relPath(templateDir, src);
      if (!rel) return true; // the template root itself

      // Directories must be traversable, or nothing beneath them is ever considered. A throw
      // inside this filter would abort the whole copy, so an unreadable entry just gets copied.
      try {
        if (statSync(src).isDirectory()) return true;
      } catch {
        return true;
      }

      if (preserveOnboardRoutes && ONBOARD_OWNED.some((r) => r.dest === rel)) {
        if (existsSync(resolve(repoDir, rel))) {
          preserved.push(rel);
          return false;
        }
        return true; // repo lacks it entirely — a stub beats a 404, and step 3b replaces it
      }

      if (TEMPLATE_OWNED_FILES.includes(rel)) return true;
      if (TEMPLATE_OWNED_PREFIXES.some((p) => rel.startsWith(p))) return true;

      // Anything else: only if the repo doesn't have it. New template files still arrive;
      // files the client evolved (package.json, layout.tsx, README) are left alone.
      if (!existsSync(resolve(repoDir, rel))) return true;
      preserved.push(rel);
      return false;
    },
  });
  return { copied: true, preserved };
}

/**
 * Write the onboard-owned API routes from jdd-ops/lib/site-routes, exactly as onboard.js does.
 *
 * Restoring rather than merely preserving, because preserving alone leaves an already-clobbered
 * repo broken forever. These three files are self-contained (they import only `next/server`), so
 * writing them into any repo is safe, and lib/site-routes is verifiably the working version: its
 * voice routes are byte-identical to the reference client's, and its contact route is a strict
 * superset — same Retell callback branch, a better email branch.
 *
 * Returns the repo-relative paths written; [] when the ops root carries no site-routes, in which
 * case copyTemplate's preserve pass has already protected whatever the repo had.
 */
export function writeOnboardRoutes(repoRoot: string, slug: string): string[] {
  const srcDir = resolve(repoRoot, 'lib', 'site-routes');
  if (!existsSync(srcDir)) return [];
  const repoDir = repoDirFor(repoRoot, slug);
  const written: string[] = [];
  for (const { asset, dest } of ONBOARD_OWNED) {
    const from = resolve(srcDir, asset);
    if (!existsSync(from)) continue;
    const to = resolve(repoDir, ...dest.split('/'));
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    written.push(dest);
  }
  return written;
}

/**
 * Union the template's dependencies into the repo's package.json.
 *
 * Neither copying nor skipping is right on an existing repo. Copying drops what the client added
 * (this is how @vercel/speed-insights disappeared from the reference client while layout.tsx
 * still tried to render it). Skipping means a repo never picks up a dependency a NEW catalog
 * component needs, and the failure lands as a module-not-found in `npm run build`.
 *
 * So: template entries are ADDED when missing, and a version the repo already pins is KEPT —
 * the repo's is the one its lockfile resolved and its repo-only components were built against.
 * Nothing is ever removed.
 */
export function mergePackageJson(repoRoot: string, slug: string): { added: string[] } {
  const repoPkgPath = resolve(repoDirFor(repoRoot, slug), 'package.json');
  const tplPkgPath = resolve(repoRoot, 'template', 'package.json');
  if (!existsSync(repoPkgPath) || !existsSync(tplPkgPath)) return { added: [] };

  type Pkg = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const repoPkg = JSON.parse(readFileSync(repoPkgPath, 'utf8')) as Pkg;
  const tplPkg = JSON.parse(readFileSync(tplPkgPath, 'utf8')) as Pkg;

  const added: string[] = [];
  for (const field of ['dependencies', 'devDependencies'] as const) {
    const tpl = tplPkg[field];
    if (!tpl) continue;
    const repoDeps = (repoPkg[field] ??= {});
    for (const [name, version] of Object.entries(tpl)) {
      if (repoDeps[name] === undefined) {
        repoDeps[name] = version;
        added.push(name);
      }
    }
  }
  if (added.length) writeFileSync(repoPkgPath, JSON.stringify(repoPkg, null, 2) + '\n', 'utf8');
  return { added };
}

/**
 * True when the repo's contact route is the retired Make-webhook version.
 *
 * The last line of defence before a push. Deliberately keyed on MAKE_WEBHOOK_URL rather than on
 * byte-equality with template/: the template's stubs are now kept in sync with lib/site-routes,
 * so a correct repo is legitimately identical to the template and an equality check would refuse
 * every deploy. What actually makes a contact route broken is that it posts leads to a Make
 * webhook nothing sets any more — a site that accepts leads and silently drops them.
 */
export function hasStubbedContactRoute(repoRoot: string, slug: string): boolean {
  const repoFile = resolve(repoDirFor(repoRoot, slug), 'src', 'app', 'api', 'contact', 'route.ts');
  if (!existsSync(repoFile)) return false;
  return /MAKE_WEBHOOK_URL/.test(readFileSync(repoFile, 'utf8'));
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
 * Verify every placed component's `@/lib/*` imports actually exist in the client repo.
 *
 * Catalog components are authored in the CONSOLE against the console's libs, then copied
 * into a repo whose libs came from `template/`. When those two drift, the component lands in
 * a repo missing a symbol it imports — and the only signal was a TypeScript error at the end
 * of `next build`, minutes into an export, phrased as a module error rather than "the
 * template is out of date". That is exactly how `parallaxY` (added to the console's motion.ts
 * and never to the template's) reached a client repo and failed the build.
 *
 * Checked against the REPO rather than `template/`, which also catches the second way this
 * bites: an export with `overwrite: false` leaves the existing repo's older libs in place, so
 * a repo can be stale even when the template is current.
 *
 * Cheap — a regex over the handful of files just written — so it runs before npm install.
 */
export interface CatalogImportProblem {
  message: string;
  /**
   * True when `template/` DOES provide the symbol and only this repo is missing it — a
   * different fix (re-export with overwrite) from genuine template drift.
   */
  staleRepo: boolean;
}

export function verifyCatalogImports(
  repoRoot: string,
  slug: string,
  written: string[],
): CatalogImportProblem[] {
  const repoDir = repoDirFor(repoRoot, slug);
  const templateLibDir = resolve(repoRoot, 'template', 'src', 'lib');
  const exportsByLib = new Map<string, Set<string> | null>();
  const templateByLib = new Map<string, Set<string> | null>();

  function readExports(dir: string, lib: string): Set<string> | null {
    let found: Set<string> | null = null;
    for (const ext of ['.ts', '.tsx']) {
      const p = resolve(dir, `${lib}${ext}`);
      if (!existsSync(p)) continue;
      const src = readFileSync(p, 'utf8');
      found = new Set<string>();
      for (const m of src.matchAll(
        /^export\s+(?:async\s+)?(?:const|function|type|interface|class|let)\s+(\w+)/gm,
      )) {
        found.add(m[1]);
      }
      for (const m of src.matchAll(/^export\s*\{([^}]+)\}/gm)) {
        for (const part of m[1].split(',')) {
          const name = part.trim().split(/\s+as\s+/).pop();
          if (name) found.add(name);
        }
      }
      break;
    }
    return found;
  }

  /** Named exports of `repo/src/lib/<lib>`, or null when the file doesn't exist. */
  function repoExportsOf(lib: string): Set<string> | null {
    if (!exportsByLib.has(lib)) {
      exportsByLib.set(lib, readExports(resolve(repoDir, 'src', 'lib'), lib));
    }
    return exportsByLib.get(lib)!;
  }

  /** The same, from `template/` — used only to tell drift apart from a stale repo. */
  function templateExportsOf(lib: string): Set<string> | null {
    if (!templateByLib.has(lib)) {
      templateByLib.set(lib, readExports(templateLibDir, lib));
    }
    return templateByLib.get(lib)!;
  }

  const problems: CatalogImportProblem[] = [];
  for (const rel of written) {
    const file = resolve(repoDir, rel);
    if (!existsSync(file)) continue;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(
      /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*'@\/lib\/([\w.]+)'/g,
    )) {
      const lib = m[2];
      const available = repoExportsOf(lib);
      if (!available) {
        problems.push({
          message: `${rel} imports '@/lib/${lib}', which does not exist in the client repo.`,
          staleRepo: templateExportsOf(lib) !== null,
        });
        continue;
      }
      for (const part of m[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (name && !available.has(name)) {
          problems.push({
            message: `${rel} imports '${name}' from '@/lib/${lib}', which the repo's copy does not export.`,
            staleRepo: templateExportsOf(lib)?.has(name) ?? false,
          });
        }
      }
    }
  }
  return problems;
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
 * Serialized verbatim — but NOT because no mapping is needed. The agency form collects a
 * BrandIntakeSubmission, whose shape is nothing like SiteContent; `mapBrandIntakeToIntake`
 * (@jdd/schema, src/brand-intake.ts) does the renaming and nesting on the AGENCY SIDE before
 * the submission ever enters the KV queue. By the time it reaches here it is already a
 * SiteContent-shaped envelope, so this writer must not touch it. If a field looks like it
 * went missing on import, that mapper is where to look — not this function.
 * Per CLAUDE.md we never invent values:
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
 * Rewrite the data object in clients/<slug>/site.ts **in place**, preserving everything
 * that precedes it.
 *
 * That file comes in two shapes, both of which loadIntake() understands:
 *   • `export const INTAKE = { plan, siteCount, sites }` — written by writeClientIntake
 *     for signups pulled off the KV queue.
 *   • `export const CONTENT: SiteContent = {…}` — blank/vertical clients, whose files
 *     carry a doc header plus ~240 lines of inline TypeScript interfaces above the data.
 *
 * Regenerating either from scratch would discard that prelude (and, for CONTENT files,
 * the interface declarations the file exports), so we splice: keep the source up to the
 * export statement, re-serialize the object, keep nothing after it. The export keyword,
 * name, and type annotation are preserved verbatim from the original.
 *
 * Returns false if no recognized export is found, so callers can 4xx rather than write
 * a file they don't understand. JSON.stringify keeps this data-only — no code injection
 * from client-supplied strings.
 */
export function rewriteClientSchema(repoRoot: string, slug: string, data: unknown): boolean {
  if (!isValidSlug(slug)) throw new Error(`Invalid slug "${slug}".`);
  const file = resolve(repoRoot, 'clients', slug, 'site.ts');
  if (!existsSync(file)) return false;
  const src = readFileSync(file, 'utf8');
  // Match the declaration head only — `export const CONTENT: SiteContent = ` / `export const INTAKE = `.
  const m = /^export\s+const\s+(INTAKE|CONTENT)\s*(:\s*[A-Za-z_$][\w$]*)?\s*=\s*/m.exec(src);
  if (!m) return false;
  const head = src.slice(0, m.index);
  const decl = `export const ${m[1]}${m[2] ?? ''} = `;
  writeFileSync(file, `${head}${decl}${JSON.stringify(data, null, 2)};\n`, 'utf8');
  return true;
}

/**
 * Walk the content tree; for every string value shaped "upload://<file>", copy the staged
 * file from console/.uploads into clients/<slug>/repo/public/images and rewrite the value to
 * "/images/<file>".
 *
 * Returns a deep clone with refs resolved, plus the filenames of any refs that could not be
 * resolved. Those still collapse to "" — but the caller reports them and backfills the slot
 * with placeholder imagery, because a staged upload vanishing between upload and export used
 * to ship an empty <img> to a live client site with nothing in the stream to say so.
 */
export function resolveUploads(
  repoRoot: string,
  slug: string,
  content: SiteContent,
): { content: SiteContent; missing: string[] } {
  const stageDir = resolve(process.cwd(), '.uploads');
  const publicImg = resolve(repoDirFor(repoRoot, slug), 'public', 'images');
  let created = false;
  const missing = new Set<string>();

  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      if (!v.startsWith('upload://')) return v;
      const file = v.slice('upload://'.length);
      const src = resolve(stageDir, file);
      if (!existsSync(src)) {
        missing.add(file);
        return '';
      }
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
  return { content: walk(content) as SiteContent, missing: [...missing] };
}
