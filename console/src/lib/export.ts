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
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { routePath, styleKeyFor, rhythmClass, navHref, type SectionRhythm, type SiteComposition } from '@/lib/pages';
import { reconcileRoutes } from '@/lib/composition-manifest';
import type { SiteContent, SectionStyle, IntakeEnvelope } from '@jdd/schema';
import { SITE_TYPES_SOURCE } from '@jdd/schema';
import { CONTENT } from '@/data/site';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { findOpsRoot } from '@/lib/opsRoot';
import {
  verifyLibImports,
  verifyUiPins,
  verifyUiLock,
  parseLsRemoteTags,
  type LibImportProblem,
  type LockResult,
  type UiPinResult,
} from '@/lib/libExports';
import { isValidSkin, supportsSkin } from '@/lib/skins';
import { VERTICAL_PRESETS } from '@/lib/verticals';

const EXCLUDE = new Set(['node_modules', '.next', '.git', 'out']);

/**
 * The provenance stamp `writeSiteContent` puts at the top of a client repo's site.ts, telling
 * onboard.js that this file is console-authored content it must not splice over.
 *
 * A SECOND COPY of `CONSOLE_CONTENT_MARKER` from jdd-ops/lib/provisioned-fields.js, and the
 * only duplicated value in this contract. The rest of the module is reached by a dynamic
 * import (see provisionedFields.ts), but that is necessarily async and `writeSiteContent` is
 * synchronous with several callers. So the string is mirrored here and
 * `console/test/provisioned-fields.test.mjs` asserts the two are identical — the same
 * arrangement, for the same reason, as the ring-window constants in envFields.ts.
 *
 * If they ever diverge, onboard.js stops recognising console-authored files and silently goes
 * back to reverting every export. The test is what makes that impossible rather than unlikely.
 */
export const CONSOLE_CONTENT_MARKER = '@jdd:content-source console-export';

/**
 * THE allowlist of category -> component file names. Guards against path traversal via
 * untrusted input, and is what `validateEntries` enforces on export.
 *
 * SINGLE SOURCE OF TRUTH. `/api/build/source` imports this rather than keeping its own copy.
 * It used to maintain a byte-identical `ALLOWED` map, and the two drifted: neither ever
 * listed the `*Starter` lead-capture variants, while the studio's `forPlan` filter in
 * categories.tsx showed *only* those to starter-plan clients. A starter client could
 * therefore pick a variant the exporter would then reject with `Unknown component`. That
 * went unnoticed because every client to date has been on growth.
 *
 * Pruned 2026-08-19 from 60 components to 28 (see design/catalog-v2/SPEC.md). Anything
 * removed here must also go from `SKINS` in lib/skins.ts and the registry in
 * app/c/[slug]/build/categories.tsx, or the studio will offer something export refuses.
 */
export const CATALOG: Record<string, readonly string[]> = {
  // `Hvac*` entries are the bespoke, pixel-faithful vertical-template components mirrored from
  // the Northstar "Home — Standard" mockup (see src/components/CATALOG-LEGACY.md). Fixed designs,
  // no `skin`, composed by VERTICAL_TEMPLATES. The Standard tab defines hero/stat-band/services/
  // service-area/FAQ; testimonials/CTA/footer/nav reuse the existing ("already working") catalog.
  // `Roofing*`, `Lawn*`, `Plumbing*` and `Detail*` are vertical-templates-v1's second through
  // fifth bespoke sets (design/EXEC-vertical-templates-v1.md Phases 5-6-8-9), mirrored from
  // design/vertical-templates-v1/home-mockups.html's #roofing, #lawn, #plumbing and #detail
  // panes. Same contract as Hvac*: fixed designs, no skin, composed by VERTICAL_TEMPLATES.
  nav:          ['NavMinimal', 'NavEmergencyBar', 'HvacNav', 'RoofingNav', 'LawnNav', 'PlumbingNav', 'DetailNav'],
  // v2.2: the lightweight header that opens a non-home page. Reads its copy from
  // SiteContent.subpages[route].header, not a global CONTENT import.
  pageHeader:   ['PageHeaderSimple', 'PageHeaderEditorial', 'PageHeaderOverlap', 'PageHeaderMinimal', 'HvacPageHeader', 'RoofingPageHeader', 'LawnPageHeader', 'PlumbingPageHeader', 'DetailPageHeader'],
  hero:         ['HeroSplit', 'HeroFormFocus', 'HeroOverlap', 'HvacHero', 'RoofingHero', 'LawnHero', 'PlumbingHero', 'DetailHero'],
  trust:        ['TrustBadges', 'TrustReviewsAggregate', 'ServiceArea', 'HvacServiceArea', 'RoofingTrust', 'LawnTrust', 'PlumbingTrust', 'DetailTrust'],
  // New section category (decision 18). Reads about.pillars; no new schema field.
  differentiators: ['DifferentiatorsIndex', 'DifferentiatorsPanels', 'DifferentiatorsRail'],
  about:        ['AboutFeature', 'AboutStory', 'AboutSticky', 'HvacAbout', 'RoofingAbout', 'LawnAbout', 'PlumbingAbout', 'DetailAbout'],
  services:     ['ServicesGrid', 'ServicesAccordion', 'ServicesPanel', 'ServicesShowcase', 'ServicesSpotlight', 'HvacServices', 'RoofingServices', 'LawnServices', 'PlumbingServices', 'DetailServices'],
  // Reframed from portfolio to recent jobs: a trades client has jobs nearby, not a portfolio.
  work:         ['RecentJobsGrid', 'BeforeAfter', 'WorkSpotlight', 'WorkMasonry'],
  // New section category (decision 18). Reads about.stats; StatsBand is the one count-up.
  stats:        ['StatsBand', 'StatsLedger', 'HvacStatBand', 'RoofingStats', 'LawnStats', 'PlumbingStats', 'DetailStats'],
  faq:          ['FaqAccordion', 'FaqStickyAside', 'FaqIndex', 'HvacFaq', 'RoofingFaq', 'LawnFaq', 'PlumbingFaq', 'DetailFaq'],
  testimonials: ['TestimonialsGrid', 'TestimonialsCarousel', 'TestimonialsMarquee', 'HvacReviews', 'RoofingReviews', 'LawnReviews', 'PlumbingReviews', 'DetailReviews'],
  finalCta:     ['FinalCtaBanner', 'FinalCtaSimple', 'FinalCtaSplit', 'HvacFinalCta', 'RoofingFinalCta', 'LawnFinalCta', 'PlumbingFinalCta', 'DetailFinalCta'],
  contact:      ['ContactSplit', 'ContactCardOverlap', 'ContactInlineStrip', 'HvacContact', 'RoofingContact', 'LawnContact', 'PlumbingContact', 'DetailContact'],
  footer:       ['FooterColumns', 'FooterMinimal', 'HvacFooter', 'RoofingFooter', 'LawnFooter', 'PlumbingFooter', 'DetailFooter'],
  seo:          ['SeoDefault', 'SeoLocalBusiness'],
};

// Categories that map to a JSX body slot in page.tsx (everything except seo, which is
// wired as a generateMetadata re-export instead of a rendered element).
const BODY_SLOTS = ['nav', 'pageHeader', 'hero', 'trust', 'differentiators', 'about', 'services', 'work', 'stats', 'testimonials', 'faq', 'finalCta', 'contact', 'footer'];

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
 * Most of those libs are now four-line `export *` shims of @jdd/ui, so reading one means
 * following the star into the package — `readLibExports` does that. The parser that preceded it
 * stopped at the shim, read it as zero exports, and failed an export of `_e2e_test_starter`
 * with 47 "the repo's copy does not export" problems against a template that was entirely
 * correct. Which is why `readLibExports` reports an unfollowable star as "could not check"
 * instead of as a missing symbol, and why it has a test.
 *
 * Cheap — a regex over the handful of files just written — so it runs before npm install.
 */
export type CatalogImportProblem = LibImportProblem;

export function verifyCatalogImports(
  repoRoot: string,
  slug: string,
  written: string[],
): CatalogImportProblem[] {
  return verifyLibImports({
    repoDir: repoDirFor(repoRoot, slug),
    templateLibDir: resolve(repoRoot, 'template', 'src', 'lib'),
    // Star re-exports resolve from the CONSOLE's node_modules, not the repo's: this runs BEFORE
    // the export's npm install, so a freshly copied repo has no node_modules at all. What keeps
    // that sound is verifyUiPins, which fails the export when the repo's @jdd/ui pin is behind
    // the template's — the only way the repo's real surface could differ from the console's.
    // process.cwd() is the console dir during an export, as placeComponents already relies on.
    nodeModules: resolve(process.cwd(), 'node_modules'),
    files: written,
  });
}

/**
 * The @jdd/ui pin compared across the console, `template/` and one client repo.
 *
 * Runs alongside verifyCatalogImports at the same export step, because it covers the half of
 * the problem the symbol check structurally can't: the symbol check reads the console's
 * node_modules, while the repo builds against its own pin. `_e2e_test_growth/repo` sat on
 * v1.0.1 against the template's v1.0.7 — and the one export added across that span,
 * `responsivePicture`, is imported by HeroSplit, which is placed in that repo.
 */
export function verifyUiPinsFor(repoRoot: string, slug: string): UiPinResult {
  return verifyUiPins({
    consolePkg: resolve(process.cwd(), 'package.json'),
    templatePkg: resolve(repoRoot, 'template', 'package.json'),
    repoPkg: resolve(repoDirFor(repoRoot, slug), 'package.json'),
  });
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

// ─── Multi-page export ────────────────────────────────────────────────────────

/**
 * The de-duplicated set of catalog components a whole composition uses — chrome (nav/footer/seo)
 * plus every page's body sections, unique by categoryId+name. This is what placeComponents copies
 * and validateEntries checks, so a component shared across pages is placed exactly once.
 */
export function collectSectionRefs(comp: SiteComposition): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  const add = (ref: { categoryId: string; name: string; skin?: string }) => {
    const key = `${ref.categoryId}::${ref.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ categoryId: ref.categoryId, name: ref.name, skin: ref.skin });
  };
  add(comp.chrome.nav);
  add(comp.chrome.footer);
  add(comp.chrome.seo);
  for (const page of comp.pages) for (const ref of page.sections) add(ref);
  return out;
}

/** `skin="…"` only for components that declare the prop — same guard as wirePage. */
function skinAttr(ref: { name: string; skin?: string }): string {
  return ref.skin && supportsSkin(ref.name) ? ` skin="${ref.skin}"` : '';
}

/**
 * Every bespoke vertical-template nav. Each one takes `currentPath` instead of `skin` (fixed
 * designs; no skin at all) so wirePages can mark the active nav link per page.
 *
 * Was a single `=== 'HvacNav'` string comparison until roofing (vertical-templates-v1 Phase 5)
 * added a second vertical nav — at a single entry there was no way to tell "the one special
 * case" from "the general rule", so the comparison just grew into a hardcoded string instead of
 * a set. A set is the version that scales to the remaining three without another rewrite.
 */
const VERTICAL_NAVS = new Set(['HvacNav', 'RoofingNav', 'LawnNav', 'PlumbingNav', 'DetailNav']);

/** The neutral header baked into a subpage when SiteContent.subpages[route] is absent, so a
 *  page whose header copy hasn't been generated still builds and renders. */
function fallbackHeaderLiteral(label: string): string {
  return JSON.stringify({ eyebrow: '', title: label, sub: '', cta: null });
}

/**
 * Generate every page file for a multi-page site from the composition. Each page renders
 * nav + its body sections + footer. Home keeps the rich SEO generateMetadata re-export; subpages
 * get literal metadata + their header copy from CONTENT.subpages[route] (with safe fallbacks).
 * The @studio:body markers are kept so the single-page read-back parser still recovers the home
 * composition. Fully regenerated each export (idempotent); stale routes are pruned.
 */
export function wirePages(
  repoRoot: string,
  slug: string,
  comp: SiteComposition,
  sectionStyles: Record<string, SectionStyle> = {},
): void {
  const repoDir = repoDirFor(repoRoot, slug);

  /** The sectionStyles key for a ref IF it carries a non-empty style, else null. A reset writes
   *  `{}`, which must NOT produce a wrapper — keeps unstyled/reset pages byte-identical to before. */
  const styledKeyOf = (ref: { id?: string; categoryId: string; name: string }): string | null => {
    const k = styleKeyFor(ref);
    const s = k ? sectionStyles[k] : undefined;
    return s && Object.keys(s).length > 0 ? k : null;
  };

  for (const page of comp.pages) {
    const isHomePage = page.route === '';
    const hasHeader = page.sections.some((r) => r.categoryId === 'pageHeader');
    const allRefs = [comp.chrome.nav, ...page.sections, comp.chrome.footer];
    const pageHasStyled = allRefs.some((r) => styledKeyOf(r) !== null);
    // subpages read CONTENT for metadata/header; a styled page reads CONTENT for sectionVars too.
    const needsContent = !isHomePage || hasHeader || pageHasStyled;

    // Unique component imports: nav, each section, footer.
    const importRefs = [comp.chrome.nav, ...page.sections, comp.chrome.footer];
    const seenImp = new Set<string>();
    const importLines = importRefs
      .filter((r) => {
        const k = `${r.categoryId}/${r.name}`;
        if (seenImp.has(k)) return false;
        seenImp.add(k);
        return true;
      })
      .map((r) => `import ${r.name} from '@/components/catalog/${r.categoryId}/${r.name}';`);

    const lines: string[] = [];
    if (!isHomePage) lines.push(`import type { Metadata } from 'next';`);
    if (needsContent) lines.push(`import { CONTENT } from '@/data/site';`);
    if (pageHasStyled) lines.push(`import { sectionVars } from '@/lib/palette';`);
    lines.push(...importLines, '');

    if (isHomePage) {
      lines.push(`export { generateMetadata } from '@/components/catalog/seo/${comp.chrome.seo.name}';`, '');
    } else {
      const rk = JSON.stringify(page.route);
      lines.push(
        `export const metadata: Metadata = {`,
        `  title: CONTENT.subpages?.[${rk}]?.seo?.title ?? CONTENT.brand.name,`,
        `  description: CONTENT.subpages?.[${rk}]?.seo?.description ?? CONTENT.brand.tagline,`,
        `};`,
        '',
      );
    }

    /** Emit one section element, wrapped in a sectionVars div only when it carries a style.
     *  Unstyled → a single 6-space-indented line, identical to the pre-styling output. */
    const emit = (inner: string, ref: { id?: string; categoryId: string; name: string; rhythm?: SectionRhythm }): string[] => {
      const k = styledKeyOf(ref);
      const rc = rhythmClass(ref.rhythm);
      // Byte-identical to the pre-rhythm output when a ref carries neither a style nor a rhythm.
      if (!k && !rc) return [`      ${inner}`];
      const cls = rc ? ` className="${rc}"` : '';
      const sty = k ? ` style={sectionVars(CONTENT.brand, CONTENT.sectionStyles?.[${JSON.stringify(k)}])}` : '';
      return [
        `      <div${cls}${sty}>`,
        `        ${inner}`,
        `      </div>`,
      ];
    };

    lines.push(
      `export default function Page() {`,
      `  return (`,
      `    <main className="font-sans text-ink">`,
      `      {/* @studio:body:start */}`,
      ...emit(
        VERTICAL_NAVS.has(comp.chrome.nav.name)
          ? `<${comp.chrome.nav.name} currentPath="${navHref(page.route)}" />`
          : `<${comp.chrome.nav.name}${skinAttr(comp.chrome.nav)} />`,
        comp.chrome.nav,
      ),
    );
    for (const ref of page.sections) {
      if (ref.categoryId === 'pageHeader') {
        const rk = JSON.stringify(page.route);
        lines.push(...emit(`<${ref.name} data={CONTENT.subpages?.[${rk}]?.header ?? ${fallbackHeaderLiteral(page.label)}} />`, ref));
      } else {
        lines.push(...emit(`<${ref.name}${skinAttr(ref)} />`, ref));
      }
    }
    lines.push(
      ...emit(`<${comp.chrome.footer.name}${skinAttr(comp.chrome.footer)} />`, comp.chrome.footer),
      `      {/* @studio:body:end */}`,
      `    </main>`,
      `  );`,
      `}`,
    );

    const dest = resolve(repoDir, ...routePath(page.route).split('/'));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, lines.join('\n') + '\n', 'utf8');
  }

  // Prunes routes this composition dropped, then records it as the new manifest. Lives in
  // composition-manifest.ts because that module owns "what did the last export write" — and
  // because, unlike this file, it is reachable from a test. See reconcileRoutes.
  reconcileRoutes(repoDir, comp);
}

/**
 * Copy the preview's v2.1 site.ts into the client repo, overwriting the
 * template's minimal placeholder schema so exported repos build with rich data.
 */
export function copySiteData(
  repoRoot: string,
  slug: string,
  transform: (c: SiteContent) => SiteContent = (c) => c,
): void {
  // Fallback path (no edited content, no vertical preset): seed the client repo with the
  // studio's preview CONTENT. Routed through writeSiteContent so the output is self-contained
  // (inlines SITE_TYPES_SOURCE) — the console's own site.ts now only re-exports @jdd/schema
  // types and must never be copied verbatim into a client repo.
  //
  // `transform` is how the export route carries provisioned fields through this branch too.
  // Defaulted to identity so the other callers (and tests) are unaffected.
  writeSiteContent(repoRoot, slug, transform(CONTENT));
}

/**
 * Write a SiteContent object as the client repo's site.ts. Inlines the canonical SiteContent
 * interface text (SITE_TYPES_SOURCE from @jdd/schema) ahead of the serialized CONTENT so the
 * generated repo defines its own local type and needs no @jdd/schema dependency on its own
 * Vercel deploy. JSON.stringify makes this data-only (no code injection from edits).
 *
 * Strips `_meta.copyBrief` before it ever reaches a client repo: the Brief stage's saved
 * inputs (business-fact overrides, custom fields, prompt edits) are operator-only working
 * data, not content the client's site should ship with, and the repo is public.
 */
export function writeSiteContent(repoRoot: string, slug: string, content: SiteContent): void {
  const { copyBrief: _copyBrief, ...restMeta } = content._meta;
  const stripped: SiteContent = { ...content, _meta: restMeta };
  // Provenance stamp, read by onboard.js (lib/provisioned-fields.js) to decide whether this
  // file is console-authored content it must leave alone. Without it, step 3 of every
  // provisioning run splices clients/{slug}/site.ts over the top and reverts the operator's
  // copy, nav and imagery to the raw intake.
  const output =
    `// ${CONSOLE_CONTENT_MARKER}\n` +
    `${SITE_TYPES_SOURCE}\nexport const CONTENT: SiteContent = ${JSON.stringify(stripped, null, 2)};\n`;
  const dest = resolve(repoDirFor(repoRoot, slug), 'src', 'data', 'site.ts');
  writeFileSync(dest, output, 'utf8');
}

/**
 * The SiteContent currently in the client repo's site.ts, or null when there isn't a readable
 * one (no repo yet, a template placeholder, a hand-edited file).
 *
 * Exists so the exporter can carry PROVISIONED fields forward. The payload the studio sends
 * holds the owner's intake phone in `brand.phone`; the repo holds the published Twilio number
 * that provisioning put there. Reading the repo is the only way to know the latter — it is not
 * in the draft, not in clients/{slug}/site.ts, and not in the studio's state.
 */
export function readRepoSiteContent(
  repoRoot: string,
  slug: string,
  extract: (src: string) => Record<string, unknown> | null,
): Record<string, unknown> | null {
  const file = resolve(repoDirFor(repoRoot, slug), 'src', 'data', 'site.ts');
  if (!existsSync(file)) return null;
  try {
    return extract(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
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
 * Seed a real clients/<slug>/site.ts from a vertical preset.
 *
 * Moved here from the deleted /api/clients/create route: Convert-to-Client on /leads is now
 * the only way a client folder comes into being by hand. Only brand.name/short are supplied
 * by the operator; everything else keeps its preset placeholder and stays listed in
 * `_meta.missing_fields` (CLAUDE.md: never invent values), minus `brand.name`.
 *
 * Throws with `code: 'EXISTS'` when the folder already has a site.ts, so the caller can 409
 * rather than overwrite, and with `code: 'BAD_VERTICAL'` for an unknown preset.
 */
export function seedClientFolder(input: {
  repoRoot: string;
  slug: string;
  name: string;
  plan: 'starter' | 'growth' | 'enterprise';
  vertical: string;
}): void {
  const { repoRoot, slug, name, plan, vertical } = input;
  if (!isValidSlug(slug)) throw new Error(`Invalid slug "${slug}".`);

  const preset = VERTICAL_PRESETS[vertical];
  if (!preset) throw Object.assign(new Error('Unknown vertical.'), { code: 'BAD_VERTICAL' });

  if (existsSync(resolve(repoRoot, 'clients', slug, 'site.ts'))) {
    throw Object.assign(new Error(`clients/${slug}/site.ts already exists, pick another slug.`), {
      code: 'EXISTS',
    });
  }

  const envelope: IntakeEnvelope = {
    plan,
    siteCount: 1,
    sites: [
      {
        ...preset,
        brand: { ...preset.brand, name, short: name },
        _meta: {
          ...preset._meta,
          generated_at: new Date().toISOString(),
          selectedPlan: plan,
          missing_fields: preset._meta.missing_fields.filter((f) => f !== 'brand.name'),
        },
      },
    ],
  };

  writeClientIntake(repoRoot, slug, envelope);
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

/**
 * The @jdd/ui lockfiles checked against the tag their own package.json pins.
 *
 * Sits beside verifyUiPinsFor because it covers the half THAT check structurally cannot: the
 * pin comparison reads package.json, and a package.json can say v1.3.0 while the lockfile next
 * to it still resolves the previous commit — which is what `npm install` leaves behind when
 * only a tag moved. The export is the right place for it: a stale lock is harmless sitting on
 * disk and dangerous at exactly the moment code reaches a client repo.
 *
 * The console and template locks are what get checked. The client repo has no lockfile of its
 * own until the export installs one, and it installs it FROM these pins.
 *
 * Network, so it is async and fails soft: `lookup` returning {} makes every tag uncheckable,
 * which is reported and is never a pass. An offline operator is not a reason to block an export.
 */
export async function verifyUiLockFor(
  repoRoot: string,
  lookup: (remote: string) => Promise<Record<string, string>> = lsRemoteTags,
): Promise<LockResult> {
  const tagCommits = await lookup(UI_REMOTE);
  const results = [
    verifyUiLock({
      pkgPath: resolve(process.cwd(), 'package.json'),
      lockPath: resolve(process.cwd(), 'package-lock.json'),
      tagCommits,
      label: 'console',
    }),
    verifyUiLock({
      pkgPath: resolve(repoRoot, 'template', 'package.json'),
      lockPath: resolve(repoRoot, 'template', 'package-lock.json'),
      tagCommits,
      label: 'template',
    }),
  ];
  return {
    problems: results.flatMap((r) => r.problems),
    uncheckable: results.flatMap((r) => r.uncheckable),
  };
}

const UI_REMOTE = 'https://github.com/JuneauDigitalDesigns/jdd-ui.git';

/**
 * `git ls-remote --tags` for the @jdd/ui remote, as tag -> commit.
 *
 * Returns {} on ANY failure — no git, no network, a timeout, a private-repo prompt. The caller
 * turns that into "uncheckable", so the worst case is the export losing one check rather than
 * an operator being blocked by their own wifi. `--tags` with an explicit URL never touches the
 * working tree, and a 10s cap stops a hung connection from stalling a build.
 */
async function lsRemoteTags(remote: string): Promise<Record<string, string>> {
  try {
    const { stdout } = await promisify(execFile)('git', ['ls-remote', '--tags', remote], {
      timeout: 10_000,
      // Refuse any credential prompt rather than hanging an export waiting on stdin.
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return parseLsRemoteTags(stdout);
  } catch {
    return {};
  }
}
