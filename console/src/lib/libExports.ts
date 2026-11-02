// What a `src/lib/<lib>` file actually exports, and whether the shared-library pins agree.
//
// The catalog's shared helpers live in @jdd/ui; `src/lib/*` keeps four-line re-export shims at
// the old paths so components can go on importing '@/lib/...' unchanged. The parser this
// replaces had no case for `export * from`, so every shim read as ZERO exports and
// verifyCatalogImports flagged all 71 catalog lib imports as missing while the template was
// perfectly fine. See PLAN-export-guard-star-reexports.md.
//
// node:fs + node:path ONLY, deliberately. console/test/export-guard.test.mjs imports this module
// directly under the tsx loader, which cannot resolve @jdd/schema (its package.json declares no
// "exports" main) and therefore cannot load export.ts at all.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** How many `export * from` hops to follow before giving up and reporting it. */
const MAX_STAR_DEPTH = 4;

/** The shared-library dependency whose pin has to agree across console, template and repo. */
export const UI_DEP = '@jdd/ui';

export interface LibExports {
  /** Named exports, or null when the lib file itself does not exist. */
  names: Set<string> | null;
  /**
   * Star re-export specifiers that could NOT be followed. When this is non-empty `names` is
   * incomplete, and a caller must not report a symbol as missing on the strength of it — that
   * is precisely the false positive this module exists to kill.
   */
  unresolved: string[];
}

/** Names a single file declares, or re-exports by name. Mutates `into`. */
function ownNames(src: string, into: Set<string>): void {
  for (const m of src.matchAll(
    /^export\s+(?:async\s+)?(?:const|function|type|interface|class|let)\s+(\w+)/gm,
  )) {
    into.add(m[1]);
  }
  for (const m of src.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (name) into.add(name);
    }
  }
  // `export * as ns from '...'` binds ONE namespace object, not the target's individual names.
  for (const m of src.matchAll(/^export\s*\*\s*as\s+(\w+)\s+from/gm)) {
    into.add(m[1]);
  }
}

/** `<dir>/<base>.ts` or `.tsx`, whichever exists first; null when neither does. */
function firstExisting(dir: string, base: string): string | null {
  for (const ext of ['.ts', '.tsx']) {
    const p = resolve(dir, `${base}${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

/** A readable source file for `p`: as-is, then +.ts/.tsx, then as a directory index. */
function resolveFile(p: string): string | null {
  try {
    if (existsSync(p) && statSync(p).isFile()) return p;
  } catch {
    /* fall through to the extension probes */
  }
  for (const ext of ['.ts', '.tsx']) {
    if (existsSync(p + ext)) return p + ext;
  }
  for (const ext of ['.ts', '.tsx']) {
    const idx = resolve(p, `index${ext}`);
    if (existsSync(idx)) return idx;
  }
  return null;
}

/** The string target out of an `exports` entry, following conditional objects. */
function flattenConditions(entry: unknown): string | null {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return null;
  const o = entry as Record<string, unknown>;
  for (const key of ['import', 'default', 'require', 'node']) {
    const v = flattenConditions(o[key]);
    if (v) return v;
  }
  return null;
}

/**
 * Where a bare specifier's source lives, via the package's own `exports` map.
 *
 * `@jdd/ui` ships raw TypeScript with a subpath map ('./skins' -> './src/skins.ts'), which is the
 * only reason this can be a file read rather than a bundler. `nodeModules` is the directory to
 * look in — passed in so the caller decides whose node_modules is authoritative, and so the test
 * can point it at a fixture.
 */
function resolvePackageSpec(spec: string, nodeModules: string): string | null {
  const parts = spec.split('/');
  const pkg = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const rest = spec.slice(pkg.length);
  const sub = rest ? `.${rest}` : '.';

  const pkgDir = resolve(nodeModules, pkg);
  const pkgJson = resolve(pkgDir, 'package.json');
  if (!existsSync(pkgJson)) return null;

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(readFileSync(pkgJson, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }

  const map = manifest.exports;
  let target: string | null = null;
  if (typeof map === 'string') {
    target = sub === '.' ? map : null;
  } else if (map && typeof map === 'object') {
    target = flattenConditions((map as Record<string, unknown>)[sub]);
  }
  if (!target && sub === '.') {
    target = flattenConditions(manifest.module) ?? flattenConditions(manifest.main);
  }
  if (!target) return null;

  return resolveFile(resolve(pkgDir, target));
}

/**
 * The named exports `<libDir>/<lib>.{ts,tsx}` provides, following `export * from` through
 * relative files and through package subpaths.
 */
export function readLibExports(libDir: string, lib: string, nodeModules: string): LibExports {
  const entry = firstExisting(libDir, lib);
  if (!entry) return { names: null, unresolved: [] };

  const names = new Set<string>();
  const unresolved: string[] = [];
  const visited = new Set<string>();

  function walk(file: string, depth: number): void {
    const key = file.toLowerCase();
    if (visited.has(key)) return; // also the cycle guard: a -> b -> a terminates here
    visited.add(key);

    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      return;
    }
    ownNames(src, names);

    for (const m of src.matchAll(/^export\s*\*\s*(?:as\s+(\w+)\s+)?from\s*['"]([^'"]+)['"]/gm)) {
      const alias = m[1];
      const spec = m[2];
      if (alias) continue; // a namespace binding; ownNames already recorded it
      if (depth >= MAX_STAR_DEPTH) {
        unresolved.push(spec);
        continue;
      }
      const target = spec.startsWith('.')
        ? resolveFile(resolve(dirname(file), spec))
        : resolvePackageSpec(spec, nodeModules);
      if (!target) {
        unresolved.push(spec);
        continue;
      }
      walk(target, depth + 1);
    }
  }

  walk(entry, 0);
  return { names, unresolved };
}

export interface LibImportProblem {
  message: string;
  /**
   * True when `template/` DOES provide what the repo is missing, so only this repo is behind —
   * a different fix (export again with overwrite) from genuine template drift.
   *
   * This comparison was dead for as long as the parser stopped at a shim: template/src/lib and
   * the repo both read as empty sets, and two empty sets can't tell you which side is behind, so
   * the flag was always false and the stale-repo branch unreachable. Following the star brings it
   * back, and the first real export after the fix needed it immediately — `_e2e_test_growth/repo`
   * carried a pre-migration `img.ts` with no `responsivePicture` while the template's shim
   * provided it, which is a stale repo and not template drift.
   */
  staleRepo: boolean;
}

/**
 * Check each placed component's `@/lib/*` named imports against what the client repo's own libs
 * actually provide, and say which side is behind when one isn't.
 *
 * Pure paths in, problems out — no repoRoot/slug knowledge — so export-guard.test.mjs can drive
 * it against fixtures. `verifyCatalogImports` in export.ts is the thin wrapper that knows where a
 * client repo lives.
 */
export function verifyLibImports(args: {
  /** Client repo root; `files` are relative to it and its libs are at `src/lib`. */
  repoDir: string;
  templateLibDir: string;
  /** node_modules to resolve a shim's bare specifier against. */
  nodeModules: string;
  /** Repo-relative paths of the component files just written. */
  files: string[];
}): LibImportProblem[] {
  const { repoDir, templateLibDir, nodeModules, files } = args;
  const repoLibDir = resolve(repoDir, 'src', 'lib');
  const repoCache = new Map<string, LibExports>();
  const templateCache = new Map<string, LibExports>();

  const cached = (cache: Map<string, LibExports>, dir: string, lib: string): LibExports => {
    let hit = cache.get(lib);
    if (!hit) {
      hit = readLibExports(dir, lib, nodeModules);
      cache.set(lib, hit);
    }
    return hit;
  };

  const problems: LibImportProblem[] = [];
  const unverified = new Set<string>();

  for (const rel of files) {
    const file = resolve(repoDir, rel);
    if (!existsSync(file)) continue;
    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*'@\/lib\/([\w.]+)'/g)) {
      const lib = m[2];
      const repo = cached(repoCache, repoLibDir, lib);
      const template = () => cached(templateCache, templateLibDir, lib);

      if (!repo.names) {
        problems.push({
          message: `${rel} imports '@/lib/${lib}', which does not exist in the client repo.`,
          staleRepo: template().names !== null,
        });
        continue;
      }

      if (repo.unresolved.length > 0) {
        // "Could not verify", not "is missing" — and the symbol-level verdict is exactly what
        // isn't available, so this is one problem per (file, lib) rather than per symbol. Loud
        // on purpose: a silent pass here is how a missing symbol reaches a client repo.
        const key = `${rel}\u0000${lib}`;
        if (!unverified.has(key)) {
          unverified.add(key);
          problems.push({
            message: `${rel} imports from '@/lib/${lib}', which re-exports ${repo.unresolved.join(', ')} — that could not be resolved, so its exports could not be checked.`,
            staleRepo: false,
          });
        }
        continue;
      }

      for (const part of m[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (name && !repo.names.has(name)) {
          const tpl = template();
          problems.push({
            message: `${rel} imports '${name}' from '@/lib/${lib}', which the repo's copy does not export.`,
            // Only the repo is behind when the template can supply it — and only when the
            // template's own read was complete, or an unresolvable star there would read as
            // "template doesn't have it either" and mislabel a stale repo as template drift.
            staleRepo: tpl.unresolved.length === 0 && (tpl.names?.has(name) ?? false),
          });
        }
      }
    }
  }

  return problems;
}

// ─── shared-library version pins ──────────────────────────────────────────────
//
// package.json is deliberately NOT template-owned (reverting it once dropped
// @vercel/speed-insights), so an overwrite export refreshes src/lib to shims and leaves the
// repo's @jdd/ui pin alone. With the shims now identical everywhere, the pin is the only place
// real drift can show up — so it is what `staleRepo` is computed from.

/** The `vX.Y.Z` tag off a `github:owner/repo#vX.Y.Z` spec; null for a branch or commit pin. */
export function pinnedTag(spec: string | undefined | null): string | null {
  if (typeof spec !== 'string') return null;
  const m = /#(v\d+\.\d+\.\d+)$/.exec(spec.trim());
  return m ? m[1] : null;
}

function parseTag(tag: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * -1 / 0 / 1, or null when either side is not a vX.Y.Z tag.
 *
 * Numeric per segment, not a string compare: v1.0.10 is NEWER than v1.0.7, and a string compare
 * gets that backwards.
 */
export function compareTags(a: string, b: string): number | null {
  const pa = parseTag(a);
  const pb = parseTag(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

export interface PinProblem {
  message: string;
  /** True when it is the client repo that is behind, not the template. */
  staleRepo: boolean;
}

export interface UiPinResult {
  problems: PinProblem[];
  /** Specs present but not tag-pinned, so not comparable. Logged, never an error — no guessing. */
  uncomparable: string[];
}

function depSpec(pkgPath: string): string | undefined {
  try {
    const m = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    return m.dependencies?.[UI_DEP];
  } catch {
    return undefined;
  }
}

/**
 * Compare the @jdd/ui pin across the console, the template and one client repo.
 *
 * Two comparisons, mapping onto the two error branches the export route already has:
 *   repo behind template    -> this client repo carries older shared libs (staleRepo)
 *   template behind console -> the template genuinely is out of date
 *
 * A repo pinned AHEAD of the template is not a problem; a repo may legitimately run ahead.
 */
export function verifyUiPins(args: {
  consolePkg: string;
  templatePkg: string;
  repoPkg: string;
}): UiPinResult {
  const repoSpec = depSpec(args.repoPkg);
  const templateSpec = depSpec(args.templatePkg);
  const consoleSpec = depSpec(args.consolePkg);

  const problems: PinProblem[] = [];
  const uncomparable: string[] = [];
  for (const spec of [repoSpec, templateSpec, consoleSpec]) {
    if (spec !== undefined && pinnedTag(spec) === null && !uncomparable.includes(spec)) {
      uncomparable.push(spec);
    }
  }

  const repoTag = pinnedTag(repoSpec);
  const templateTag = pinnedTag(templateSpec);
  const consoleTag = pinnedTag(consoleSpec);

  if (repoSpec === undefined && templateSpec !== undefined) {
    problems.push({
      message: `The client repo's package.json has no "${UI_DEP}" dependency, but template/package.json pins ${templateSpec}.`,
      staleRepo: true,
    });
  }

  if (repoTag && templateTag && (compareTags(repoTag, templateTag) ?? 0) < 0) {
    problems.push({
      message: `The client repo pins ${UI_DEP} ${repoTag}, but template/package.json pins ${templateTag} — the repo is running older shared libraries.`,
      staleRepo: true,
    });
  }

  if (templateTag && consoleTag && (compareTags(templateTag, consoleTag) ?? 0) < 0) {
    problems.push({
      message: `template/package.json pins ${UI_DEP} ${templateTag}, but the console authors components against ${consoleTag} — the template is out of date.`,
      staleRepo: false,
    });
  }

  return { problems, uncomparable };
}

// ─── does the lockfile actually resolve the tag the pin names? ────────────────
//
// `verifyUiPins` above compares the three package.json pins against each other. That is a real
// check and it catches a half-done bump. It cannot catch the one that nearly shipped the SMS
// consent disclosure as a no-op on 2026-11-02:
//
//   package.json    "@jdd/ui": "github:JuneauDigitalDesigns/jdd-ui#v1.3.0"
//   package-lock    "resolved": "…/jdd-ui.git#16eabee…"      <- v1.2.0's commit
//   node_modules    @jdd/ui/src/ has no lead-consent-text.ts at all
//
// npm does not re-resolve a `github:` ref when only the tag moves. Editing the pin and running
// `npm install` updates the lock's declared SPEC and leaves `resolved` where it was, so every
// file on disk claims the new version while the previous component is what actually builds.
// Nothing errors anywhere. It takes `npm install github:owner/repo#vX.Y.Z` explicitly.
//
// This is the worst shape a failure can take in this repo, and it is the inverse of a false
// red: a false GREEN, reporting success while serving the old behaviour. For the consent work
// specifically it meant a client site collecting phone numbers with no disclosure, which is
// the exact thing that work exists to prevent.
//
// The tag -> commit mapping is an ARGUMENT, never derived here. Same reason probeTwilioNumber
// is handed the host Vercel actually reports instead of re-deriving it from the slug: a
// predicate that computes the truth it checks against can only ever agree with itself. The
// caller reads the mapping from `git ls-remote --tags` or a local clone.

export interface LockResult {
  problems: PinProblem[];
  /**
   * Why no comparison could be made — no tag pin, no mapping for that tag, an unreadable lock.
   *
   * Reported separately and never folded into `problems`, because "could not check" is not a
   * pass and is not a failure either. Same tri-state the onboard checks use.
   */
  uncheckable: string[];
}

/** One commit is the other, allowing either side to be abbreviated. */
function sameCommit(a: string, b: string): boolean {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()];
  const n = Math.min(x.length, y.length);
  return n >= 7 && x.slice(0, n) === y.slice(0, n);
}

function uiLockEntry(lockPath: string): { spec?: string; commit?: string; resolved?: string; read: boolean } {
  try {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
      packages?: Record<string, { resolved?: string; dependencies?: Record<string, string> }>;
    };
    const packages = lock.packages ?? {};
    const resolved = packages[`node_modules/${UI_DEP}`]?.resolved;
    const commit = resolved ? /#([0-9a-fA-F]{7,40})$/.exec(resolved)?.[1] : undefined;
    return { spec: packages['']?.dependencies?.[UI_DEP], commit, resolved, read: true };
  } catch {
    return { read: false };
  }
}

/**
 * Check one package.json against its own lockfile: the lock must resolve the commit that the
 * pinned tag points at, and must agree with package.json about which tag that is.
 *
 * @param args.tagCommits tag -> commit sha. A tag absent from it is `uncheckable`, not a pass.
 */
export function verifyUiLock(args: {
  pkgPath: string;
  lockPath: string;
  tagCommits?: Record<string, string>;
  /** Shown in messages so an operator knows WHICH lockfile ("console", "template"). */
  label?: string;
}): LockResult {
  const problems: PinProblem[] = [];
  const uncheckable: string[] = [];
  const where = args.label ? `${args.label}: ` : '';

  const spec = depSpec(args.pkgPath);
  const tag = pinnedTag(spec);
  const entry = uiLockEntry(args.lockPath);

  if (!entry.read) {
    uncheckable.push(`${where}could not read ${args.lockPath}.`);
    return { problems, uncheckable };
  }
  if (spec === undefined) {
    uncheckable.push(`${where}package.json has no "${UI_DEP}" dependency to check the lock against.`);
    return { problems, uncheckable };
  }
  if (tag === null) {
    // A branch or commit pin is a deliberate choice, not drift. Nothing to compare a tag to.
    uncheckable.push(`${where}${UI_DEP} is pinned to ${spec}, which is not a vX.Y.Z tag.`);
    return { problems, uncheckable };
  }

  // The lock's own idea of the spec. When this disagrees, the lock was never regenerated at
  // all — which is a problem on its own, and the most common way the resolved commit is stale.
  if (entry.spec !== undefined && entry.spec !== spec) {
    problems.push({
      message: `${where}package.json pins ${UI_DEP} ${spec}, but the lockfile still records ${entry.spec} — the lockfile was not regenerated.`,
      staleRepo: false,
    });
  }

  if (!entry.commit) {
    problems.push({
      message: `${where}the lockfile has no resolved commit for ${UI_DEP}${
        entry.resolved ? ` (resolved: ${entry.resolved})` : ''
      }, so there is no way to tell which code installs.`,
      staleRepo: false,
    });
    return { problems, uncheckable };
  }

  const want = args.tagCommits?.[tag];
  if (!want) {
    uncheckable.push(
      `${where}no commit known for ${tag}; pass tagCommits from \`git ls-remote --tags\` to compare it against the lock's ${entry.commit.slice(0, 7)}.`,
    );
    return { problems, uncheckable };
  }

  if (!sameCommit(entry.commit, want)) {
    problems.push({
      message: `${where}package.json pins ${UI_DEP} ${tag} (${want.slice(0, 7)}), but the lockfile resolves ${entry.commit.slice(0, 7)} — the build installs different code than the pin claims. Run \`npm install "${spec}"\` to re-resolve it.`,
      staleRepo: false,
    });
  }

  return { problems, uncheckable };
}
