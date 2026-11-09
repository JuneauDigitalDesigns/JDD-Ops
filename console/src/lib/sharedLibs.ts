// Bringing a client repo's shared libraries up to the template, and proving its lead form and
// its /api/contact route agree before anything ships.
//
// node:fs + node:path ONLY, for the reason libExports.ts gives: the console tests import this
// module directly under the tsx loader, which cannot load export.ts.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

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
 * Refreshing exactly these is the entire purpose of `overwrite`. Everything outside this list
 * belongs to the client repo once it exists.
 */
export const TEMPLATE_OWNED_PREFIXES = ['src/lib/', 'src/styles/'];
export const TEMPLATE_OWNED_FILES = [
  'next.config.js',
  'postcss.config.js',
  'tailwind.config.ts',
  'tsconfig.json',
  // Rewritten immediately afterwards by writeSiteContent/wirePage; listed so an existing repo
  // still gets a clean base if either of those is ever skipped.
  'src/data/site.ts',
  'src/app/page.tsx',
];

/** Rewritten from the studio on every export, so never part of a shared-library change list. */
const STUDIO_WRITTEN = new Set(['src/data/site.ts', 'src/app/page.tsx']);

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out']);

const UI = '@jdd/ui';

/** The two pin functions from jdd-ops/lib/ui-pin.js, injected so this file needs no loader. */
export interface UiPinRules {
  uiPinMove(repoDir: string, templateDir: string): { from: string; to: string } | null;
  isInstallableUiSpec(spec: unknown): boolean;
}

export type FileChange = { path: string; kind: 'changed' | 'added' };

/**
 * Everything a confirmed shared-library update writes, listed before any of it happens.
 *
 * The operator confirms THIS, so it has to be the whole of it: the pin, the lockfile npm
 * re-resolves, the template-owned files the update refreshes (the update implies overwrite), the
 * provisioning-owned routes, and any dependency the template has that the repo lacks.
 */
export interface SharedLibUpgrade {
  from: string;
  to: string;
  fromTag: string | null;
  toTag: string | null;
  /** True when the repo has a package-lock.json for npm to re-resolve. */
  hasLockfile: boolean;
  /** Template-owned files that differ from template/ (studio-written files excluded). */
  templateFiles: FileChange[];
  /** Provisioning-owned routes that differ from jdd-ops/lib/site-routes. */
  routes: FileChange[];
  /** Template dependencies the repo's package.json does not have yet. */
  addedDeps: string[];
}

const tagOf = (spec: string | undefined) => /#(v\d+\.\d+\.\d+)$/.exec(spec ?? '')?.[1] ?? null;

function sameBytes(a: string, b: string): boolean {
  if (!existsSync(a) || !existsSync(b)) return false;
  return readFileSync(a).equals(readFileSync(b));
}

function walk(dir: string, rel: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(resolve(dir, e.name), childRel, out);
    else out.push(childRel);
  }
}

/** Template-owned files whose repo copy differs from template/, as an overwrite would write them. */
export function templateOwnedChanges(templateDir: string, repoDir: string): FileChange[] {
  const rels: string[] = [];
  for (const prefix of TEMPLATE_OWNED_PREFIXES) {
    const sub = prefix.replace(/\/$/, '');
    const found: string[] = [];
    walk(resolve(templateDir, ...sub.split('/')), sub, found);
    rels.push(...found);
  }
  for (const f of TEMPLATE_OWNED_FILES) {
    if (existsSync(resolve(templateDir, ...f.split('/')))) rels.push(f);
  }
  const out: FileChange[] = [];
  for (const rel of rels.sort()) {
    if (STUDIO_WRITTEN.has(rel)) continue;
    const from = resolve(templateDir, ...rel.split('/'));
    const to = resolve(repoDir, ...rel.split('/'));
    if (!existsSync(to)) out.push({ path: rel, kind: 'added' });
    else if (!sameBytes(from, to)) out.push({ path: rel, kind: 'changed' });
  }
  return out;
}

/** Provisioning-owned routes whose repo copy differs from lib/site-routes. */
export function onboardRouteChanges(siteRoutesDir: string, repoDir: string): FileChange[] {
  const out: FileChange[] = [];
  for (const { asset, dest } of ONBOARD_OWNED) {
    const from = resolve(siteRoutesDir, asset);
    if (!existsSync(from)) continue;
    const to = resolve(repoDir, ...dest.split('/'));
    if (!existsSync(to)) out.push({ path: dest, kind: 'added' });
    else if (!sameBytes(from, to)) out.push({ path: dest, kind: 'changed' });
  }
  return out;
}

type Pkg = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

/** Template dependencies the repo lacks: what mergePackageJson would add. */
export function missingTemplateDeps(templatePkgPath: string, repoPkgPath: string): string[] {
  if (!existsSync(templatePkgPath) || !existsSync(repoPkgPath)) return [];
  const tpl = JSON.parse(readFileSync(templatePkgPath, 'utf8')) as Pkg;
  const repo = JSON.parse(readFileSync(repoPkgPath, 'utf8')) as Pkg;
  const added: string[] = [];
  for (const field of ['dependencies', 'devDependencies'] as const) {
    for (const name of Object.keys(tpl[field] ?? {})) {
      if (repo[field]?.[name] === undefined) added.push(name);
    }
  }
  return added;
}

/**
 * The shared-library update this repo needs, or null when its @jdd/ui is current (or pinned to
 * something that isn't a version tag, which is left alone on purpose — see lib/ui-pin.js).
 *
 * Throws when the template's pin is not one this route will hand to npm, rather than offering
 * an update it would then refuse to run.
 */
export function planSharedLibUpgrade(args: {
  opsRoot: string;
  repoDir: string;
  rules: UiPinRules;
}): SharedLibUpgrade | null {
  const templateDir = resolve(args.opsRoot, 'template');
  if (!existsSync(resolve(args.repoDir, 'package.json'))) return null;
  const move = args.rules.uiPinMove(args.repoDir, templateDir);
  if (!move) return null;
  if (!args.rules.isInstallableUiSpec(move.to)) {
    throw new Error(
      `template/package.json pins ${UI} as "${move.to}", which is not a github:owner/repo#vX.Y.Z tag, so the console will not install it.`,
    );
  }
  return {
    from: move.from,
    to: move.to,
    fromTag: tagOf(move.from),
    toTag: tagOf(move.to),
    hasLockfile: existsSync(resolve(args.repoDir, 'package-lock.json')),
    templateFiles: templateOwnedChanges(templateDir, args.repoDir),
    routes: onboardRouteChanges(resolve(args.opsRoot, 'lib', 'site-routes'), args.repoDir),
    addedDeps: missingTemplateDeps(resolve(templateDir, 'package.json'), resolve(args.repoDir, 'package.json')),
  };
}

/**
 * Whether the request confirmed exactly the update that is due now.
 *
 * Both ends must match. A confirmation of v1.0.7 → v1.4.0 does not cover v1.0.7 → v1.5.0 if the
 * template moved after the dialog was opened: the operator never saw that change.
 */
export function confirmsUpgrade(
  plan: Pick<SharedLibUpgrade, 'from' | 'to'>,
  confirmed: unknown,
): boolean {
  if (!confirmed || typeof confirmed !== 'object') return false;
  const c = confirmed as { from?: unknown; to?: unknown };
  return c.from === plan.from && c.to === plan.to;
}

/**
 * What the export does about the shared libraries, given the update due and the request.
 *
 * `refuse` happens before the export writes anything; `apply` is the only way the repo's
 * @jdd/ui pin changes; `none` leaves it alone.
 */
export function decideUpgrade(
  due: SharedLibUpgrade | null,
  confirmed: unknown,
): { kind: 'none' } | { kind: 'refuse'; plan: SharedLibUpgrade } | { kind: 'apply'; plan: SharedLibUpgrade } {
  if (!due) return { kind: 'none' };
  return confirmsUpgrade(due, confirmed) ? { kind: 'apply', plan: due } : { kind: 'refuse', plan: due };
}

/** The plan as lines for an error frame's detail, so a refusal says exactly what is pending. */
export function describeUpgrade(plan: SharedLibUpgrade): string {
  const lines = [
    `package.json: ${UI} ${plan.fromTag ?? plan.from} → ${plan.toTag ?? plan.to}`,
    plan.hasLockfile
      ? `package-lock.json: re-resolved by npm install ${plan.to}`
      : `package-lock.json: created by npm install ${plan.to}`,
  ];
  if (plan.addedDeps.length) lines.push(`package.json: adds ${plan.addedDeps.join(', ')} from the template`);
  for (const f of plan.templateFiles) lines.push(`${f.path}: ${f.kind === 'added' ? 'added' : 'refreshed'} from template/`);
  for (const f of plan.routes) lines.push(`${f.path}: ${f.kind === 'added' ? 'added' : 'rewritten'} from lib/site-routes`);
  return lines.join('\n');
}

// ─── does the lead form agree with /api/contact? ───────────────────────────────
//
// @jdd/ui v1.4.0's form posts a consent record (`callConsent`) for an AI callback, and the route
// that checks it is jdd-ops/lib/site-routes/contact.route.ts. They reach a client repo by
// different roads: the form through the repo's @jdd/ui pin, the route through onboard.js and the
// export. Either half alone fails without an error:
//   • new route, old form — the route never sees consent, so nobody is ever called back;
//   • new form, old route — the AI calls the lead back without the route checking consent.
// So the check reads what will actually be built: the INSTALLED package in node_modules (which
// is where a lockfile that resolves an older commit than the pin shows up) and the route on disk.

/** Every string literal in a `'a' + "b"` concatenation, joined. Null if anything else is in it. */
function joinLiterals(expr: string): string | null {
  const literal = /'([^'\\\n]*)'|"([^"\\\n]*)"/g;
  // Whatever is left once the literals are gone may only be the `+` signs and whitespace.
  if (expr.replace(literal, '').replace(/[\s+]/g, '') !== '') return null;
  const parts = [...expr.matchAll(literal)].map((m) => m[1] ?? m[2] ?? '');
  return parts.length ? parts.join('') : null;
}

const canonical = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The consent version and wording the installed form shows, or null when it has none. */
export function formConsentWording(consentTextSrc: string | null): { version: string; wording: string | null } | null {
  if (!consentTextSrc) return null;
  const version = /export const LEAD_CALL_CONSENT_VERSION\s*=\s*'([^']+)'/.exec(consentTextSrc)?.[1];
  if (!version) return null;
  const expr = /export const LEAD_CALL_CONSENT_TEMPLATE\s*=([\s\S]*?);[ \t]*\r?\n/.exec(consentTextSrc)?.[1];
  const wording = expr ? joinLiterals(expr) : null;
  return { version, wording: wording === null ? null : canonical(wording) };
}

/** Version → wording the route accepts, or null when the route does not check consent at all. */
export function routeConsentWordings(routeSrc: string | null): Map<string, string | null> | null {
  if (!routeSrc || !/CALL_CONSENT_WORDING/.test(routeSrc)) return null;
  const body = /const CALL_CONSENT_WORDING[^=]*=\s*\{([\s\S]*?)\r?\n\};/.exec(routeSrc)?.[1] ?? '';
  const out = new Map<string, string | null>();
  for (const m of body.matchAll(/'([^']+)':\s*((?:'[^'\\]*'|"[^"\\]*")(?:\s*\+\s*(?:'[^'\\]*'|"[^"\\]*"))*)\s*,/g)) {
    const w = joinLiterals(m[2]);
    out.set(m[1], w === null ? null : canonical(w));
  }
  return out;
}

export type PairingResult =
  | { ok: true; version: string }
  | { ok: false; reason: string };

/**
 * The installed form and the repo's contact route, judged together.
 *
 * Fails closed: anything that cannot be read is a refusal, because the cost of a false pass is
 * either a lead nobody calls or an AI call nobody consented to.
 */
export function checkFormRoutePairing(input: {
  /** node_modules/@jdd/ui/src/lead-consent-text.ts, or null if the file is absent. */
  consentTextSrc: string | null;
  /** node_modules/@jdd/ui/src/LeadForm.tsx, or null if the file is absent. */
  leadFormSrc: string | null;
  /** src/app/api/contact/route.ts, or null if the file is absent. */
  routeSrc: string | null;
  /** For messages: what the repo has installed, e.g. "v1.0.7". */
  installedLabel?: string;
}): PairingResult {
  const installed = input.installedLabel ? `${UI} ${input.installedLabel}` : `the installed ${UI}`;
  if (!input.routeSrc) {
    return { ok: false, reason: 'The repo has no src/app/api/contact/route.ts, so its lead form posts to nothing.' };
  }
  const accepted = routeConsentWordings(input.routeSrc);
  const form = formConsentWording(input.consentTextSrc);
  const formPosts = Boolean(form) && /callConsent/.test(input.leadFormSrc ?? '');

  if (!accepted) {
    return {
      ok: false,
      reason:
        `src/app/api/contact/route.ts does not check consent before the AI calls a lead back` +
        (formPosts ? `, while the form from ${installed} asks for it.` : '.') +
        ' The current route is jdd-ops/lib/site-routes/contact.route.ts.',
    };
  }
  if (!form || !formPosts) {
    return {
      ok: false,
      reason:
        `The lead form from ${installed} has no AI-call consent box, but src/app/api/contact/route.ts only calls a lead back with that consent. ` +
        'Every callback on this site would stop.',
    };
  }
  if (!accepted.has(form.version)) {
    return {
      ok: false,
      reason: `The lead form from ${installed} sends consent version "${form.version}", which src/app/api/contact/route.ts does not accept (it accepts ${[...accepted.keys()].join(', ') || 'none'}).`,
    };
  }
  const routeWording = accepted.get(form.version);
  if (!form.wording || !routeWording || form.wording !== routeWording) {
    return {
      ok: false,
      reason: `The consent wording for "${form.version}" differs between the lead form from ${installed} and src/app/api/contact/route.ts, so the route would reject every consent.`,
    };
  }
  return { ok: true, version: form.version };
}

/** Read the installed form and the route from a repo, then judge them. */
export function checkRepoFormRoutePairing(repoDir: string): PairingResult {
  const read = (...p: string[]) => {
    const f = resolve(repoDir, ...p);
    return existsSync(f) && statSync(f).isFile() ? readFileSync(f, 'utf8') : null;
  };
  const pkg = read('node_modules', '@jdd', 'ui', 'package.json');
  let version: string | undefined;
  try {
    version = pkg ? (JSON.parse(pkg) as { version?: string }).version : undefined;
  } catch {
    version = undefined;
  }
  return checkFormRoutePairing({
    consentTextSrc: read('node_modules', '@jdd', 'ui', 'src', 'lead-consent-text.ts'),
    leadFormSrc: read('node_modules', '@jdd', 'ui', 'src', 'LeadForm.tsx'),
    routeSrc: read('src', 'app', 'api', 'contact', 'route.ts'),
    installedLabel: version ? `v${version}` : undefined,
  });
}
