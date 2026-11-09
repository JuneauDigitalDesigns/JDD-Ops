import { spawn } from 'node:child_process';
import {
  copyTemplate,
  copySiteData,
  hasStubbedContactRoute,
  mergePackageJson,
  readRepoSiteContent,
  writeOnboardRoutes,
  writeSiteContent,
  isValidSlug,
  placeComponents,
  repoDirFor,
  repoExists,
  resolveRepoRoot,
  resolveUploads,
  validateEntries,
  wirePage,
  wirePages,
  collectSectionRefs,
  verifyCatalogImports,
  verifyUiPinsFor,
  verifyUiLockFor,
  verifyRepoUiLockFor,
  type Entry,
} from '@/lib/export';
import {
  checkRepoFormRoutePairing,
  decideUpgrade,
  describeUpgrade,
  planSharedLibUpgrade,
  type SharedLibUpgrade,
} from '@/lib/sharedLibs';
import { loadUiPinRules } from '@/lib/uiPinRules';
import { loadSiteLayout } from '@/lib/siteLayout';
import { findMissingLocalImages } from '@/lib/imageRefs';
import { navLinksFor, validateComposition, type SiteComposition } from '@/lib/pages';
import { remapFooterCols } from '@/app/c/[slug]/build/nav-targets';
import type { SiteContent } from '@/data/site';
import { fillImagePlaceholders } from '@/data/image-placeholders';
import { materializeImages } from '@/lib/image-pipeline';
import { presetFor, type VerticalId } from '@/lib/verticals';
import { resolveVerticalIds } from '@/lib/verticals-registry';
import { resolveDeployTarget, readSyncState, runGit, type GitResult } from '@/lib/git-state';
import { loadGithubToken } from '@/lib/opsSecrets';
import { deleteDraft } from '@/lib/draft';
import { lockedReason } from '@/lib/onboardingGate';
import { loadProvisionedFields } from '@/lib/provisionedFields';

/** npm install and next build are both legitimately slow; past this they are stuck, not slow. */
const NPM_TIMEOUT_MS = 10 * 60_000;
/** Local git plumbing is instantaneous or broken. */
const GIT_TIMEOUT_MS = 30_000;
/** The only git call that touches the network. */
const PUSH_TIMEOUT_MS = 120_000;
/** Cadence for keeping the stream (and the client's idle watchdog) alive during npm steps. */
const HEARTBEAT_MS = 10_000;
/** What runNpm will put on a shell command line besides its own literals: no spaces, quotes or metacharacters. */
const SHELL_SAFE_ARG = /^[A-Za-z0-9:_./#-]+$/;

/**
 * Fill empty/preset-picsum image slots with the vertical's curated stock and record what was
 * filled at `_meta.placeholder_images`, so a placeholder stays distinguishable from a real
 * client photo and a later re-export re-evaluates it rather than trusting it.
 *
 * `includeWork` is deliberately NOT passed: that block injects fabricated case studies with
 * invented locations and years, which must not reach a client site.
 */
function withPlaceholders(
  content: SiteContent,
  vertical: VerticalId | null | undefined,
  step: (message: string) => void,
): SiteContent {
  const { content: filledContent, filled } = fillImagePlaceholders(content, vertical ?? 'hvac');
  if (filled.length === 0) return filledContent;
  step(
    `Filled ${filled.length} empty image slot(s) with ${vertical ?? 'stock'} placeholder photography.`,
  );
  return { ...filledContent, _meta: { ...filledContent._meta, placeholder_images: filled } };
}

/** git splits its output across both pipes; error detail needs whichever one carries it. */
function gitTail(r: GitResult): string {
  return [r.stdout, r.stderr].filter((s) => s.trim()).join('\n').split('\n').slice(-40).join('\n');
}

/** Loose guard: the edited content payload must at least carry brand + hero. */
function isValidSiteContent(x: unknown): x is SiteContent {
  return typeof x === 'object' && x !== null && 'brand' in x && 'hero' in x;
}

// Server-side export: copy the blank template into clients/<slug>/repo, drop the selected
// components in, wire them into page.tsx, then npm install + npm run build to verify.
// Streams newline-delimited JSON (NDJSON) so the UI can narrate progress in plain English.
//
// Runs in the Node runtime (fs + child_process); never static.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  slug?: string;
  overwrite?: boolean;
  selections?: Entry[];
  /** Multi-page composition. When present, the site is exported as N page files (wirePages);
   *  otherwise the legacy single-page path (selections → wirePage) runs unchanged. */
  composition?: SiteComposition;
  vertical?: string;
  content?: unknown;
  /** Also commit + push, so Vercel's GitHub integration redeploys the live site. */
  deploy?: boolean;
  /** Written verbatim as the commit message. Required when `deploy` is set. */
  commitMessage?: string;
  /**
   * The shared-library update the operator confirmed, exactly as /api/build/export/plan showed
   * it. Applied only when it names the update that is due right now; see confirmsUpgrade.
   */
  uiUpgrade?: { from?: string; to?: string };
};

export async function POST(req: Request) {
  // Computed per-request, not at module load: it reads console/.state/verticals.json, which
  // an operator can edit (via the vertical editor, or by hand) while this server process is
  // still running. A module-scope Set would freeze whatever existed at server start and
  // never see a newly added custom vertical, or a vertical whose id was corrected, without
  // a restart. Was also a hardcoded Set missing 'health' — a health client exported with
  // vertical = null, and withPlaceholders(content, null ?? 'hvac') silently filled its empty
  // image slots with HVAC stock photography.
  const VALID_VERTICALS = new Set<string>(resolveVerticalIds());

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  const overwriteRequested = Boolean(body.overwrite);
  const selections = Array.isArray(body.selections) ? body.selections : [];
  // Multi-page export path when a composition is supplied; else the legacy single-page path.
  const composition = body.composition && typeof body.composition === 'object' && Array.isArray(body.composition.pages)
    ? body.composition
    : null;
  const vertical = typeof body.vertical === 'string' && VALID_VERTICALS.has(body.vertical)
    ? (body.vertical as VerticalId)
    : null;
  const content = isValidSiteContent(body.content) ? body.content : null;
  const deploy = Boolean(body.deploy);
  // The message is operator-authored now (the deploy dialog exposes it as an editable field), so
  // normalise it before it reaches git. Defence in depth only — the real protection is that
  // runGit uses execFile with no shell, so nothing in here can be reinterpreted as a command.
  // \0 can't survive an argv element and \r turns a commit body into mojibake in `git log`.
  const commitMessage = (body.commitMessage ?? '')
    .replace(/\0/g, '')
    .replace(/\r/g, '')
    .trim()
    .slice(0, 20_000);
  if (deploy && !commitMessage) {
    return new Response('A commit message is required to deploy.', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const step = (message: string) => send({ type: 'step', message });
      /** Set once a push succeeds, so `done` can report what actually reached the remote. */
      let pushed: { branch: string; sha: string | null; fullSha: string | null } | null = null;

      try {
        if (!slug) throw new Error('Choose or name a client first.');
        if (!isValidSlug(slug)) {
          throw new Error('Client name may only contain letters, numbers, hyphens and underscores.');
        }
        // Onboarding gate, third layer. Thrown so the catch below reports it on the stream
        // like any other failure. An export of a placeholder folder would scaffold a repo
        // from preset content and, with `deploy`, push it.
        const lockedMsg = await lockedReason(slug);
        if (lockedMsg) throw new Error(lockedMsg);
        /**
         * Structural validation of the composition, SERVER-SIDE, before anything is written.
         *
         * `validateEntries` below cannot stand in for this: it checks the flattened component
         * list against the catalog allowlist, and chrome alone fills that list with three
         * valid entries. A composition whose pages are empty passes it cleanly — which is how
         * a client site went live as a nav bar stacked on a footer, with every subpage route
         * deleted by pruneStaleRoutes on the way out.
         *
         * `validateComposition` is the UI's own validator and it had no callers anywhere; the
         * rules it encodes were being enforced on nobody. Throwing here puts the message on
         * the NDJSON stream through the catch below, like any other export failure.
         */
        if (composition) validateComposition(composition);
        const entries = validateEntries(composition ? collectSectionRefs(composition) : selections);
        const repoRoot = resolveRepoRoot();

        /**
         * Localize every image into the repo's /public/img and record `_meta.local_images`
         * (Phase 11). Runs AFTER withPlaceholders so stock is localized too, and BEFORE
         * writeSiteContent so the written site.ts already points at the local files. Never throws:
         * a failed fetch leaves that slot hotlinked and is reported. The repo already exists here
         * (copyTemplate ran above), so /public/img can be written into it.
         */
        const materialize = async (c: SiteContent): Promise<SiteContent> => {
          const mat = await materializeImages(repoRoot, slug, c, step);
          if (mat.localized.length || mat.failed.length) {
            step(
              `Localized ${mat.localized.length} image(s) into /public/img` +
                (mat.failed.length ? `; ${mat.failed.length} could not be fetched and stay hotlinked.` : '.'),
            );
          }
          return mat.content;
        };

        // Multi-page: the site nav becomes route links generated from the composition (Home,
        // Services, …), not the single-page anchor links. Generated routing, not client copy.
        if (composition && content) {
          content.nav = navLinksFor(composition);

          // The rest of the site chrome carries single-page anchors too. On a multi-page site a
          // footer `#services`/`#about`/… link scrolls to nothing from every page that doesn't
          // host that section — the same class of dead link the nav regeneration above fixes.
          // Rewrite each footer link to the route that actually carries its section; refuse the
          // export when a link points at a section on NO page, so a dead chrome link surfaces in
          // the deploy dialog (this stream) instead of shipping silently. Runs BEFORE copyTemplate
          // and the npm steps, so it fails fast; it only edits content.footer (not the
          // composition or the provisioned-fields snapshot taken below).
          if (content.footer?.cols?.length) {
            const { cols, dangling } = remapFooterCols(content.footer, composition);
            if (dangling.length > 0) {
              const list = dangling.map((d) => `  • “${d.label}” (${d.href}) in footer column “${d.col}”`).join('\n');
              throw new Error(
                `This footer links to ${dangling.length} section${dangling.length === 1 ? '' : 's'} that ${dangling.length === 1 ? 'is' : 'are'} on no page of the site, so ${dangling.length === 1 ? 'it' : 'they'} would scroll to nothing:\n${list}\n\n` +
                  'Add a page or section that carries that content in the Studio, or remove the link, then export again.',
              );
            }
            content.footer = { ...content.footer, cols };
          }
        }

        /**
         * The shared-library update, decided BEFORE anything is written.
         *
         * A repo whose @jdd/ui is behind the template's used to get as far as rewriting site.ts,
         * the routes and the components before the pin check refused it, which left the repo
         * half-exported on disk. Now an unconfirmed update stops here with nothing changed, and
         * hands the dialog the exact list to show. A confirmed one must name this very update:
         * if the template moved since the dialog opened, the operator never saw the new target.
         */
        let upgrade: SharedLibUpgrade | null = null;
        if (repoExists(repoRoot, slug)) {
          const decision = decideUpgrade(
            planSharedLibUpgrade({
              opsRoot: repoRoot,
              repoDir: repoDirFor(repoRoot, slug),
              rules: await loadUiPinRules(),
            }),
            body.uiUpgrade,
          );
          if (decision.kind === 'refuse') {
            const due = decision.plan;
            send({
              type: 'error',
              message: `This client’s repo uses @jdd/ui ${due.fromTag ?? due.from}; the template uses ${due.toTag ?? due.to}. Nothing was changed.`,
              detail: `Pending shared-library update:\n${describeUpgrade(due)}`,
              next: 'Tick “Update shared libraries” to confirm the changes listed, then run this again.',
              uiUpgrade: due,
            });
            return;
          }
          if (decision.kind === 'apply') upgrade = decision.plan;
        }
        if (upgrade) {
          step(
            `Updating shared libraries (confirmed): @jdd/ui ${upgrade.fromTag ?? upgrade.from} → ${upgrade.toTag ?? upgrade.to}, with src/lib refreshed from the template.`,
          );
        }

        /**
         * Snapshot what PROVISIONING put in this repo's site.ts, before anything overwrites it.
         *
         * Must happen before `copyTemplate`: `src/data/site.ts` is in TEMPLATE_OWNED_FILES, so
         * an overwrite export (which is every deploy) reverts it to the template's placeholder
         * on the very next statement. Read it afterwards and the provisioned values are already
         * gone — the snapshot would be of the template, and the overlay a no-op.
         *
         * The field that matters is `brand.phone`/`phoneHref`. The studio's payload carries the
         * OWNER'S number from the intake; the repo carries the published JDD Twilio number that
         * `applyTwilioNumberToSite` wrote. Shipping the payload verbatim republishes the owner's
         * line, and from then on every inbound caller reaches the owner directly instead of
         * `/api/voice` — no human-first forward, no Retell fallback, no Airtable row, and
         * nothing anywhere that reads as an error. See jdd-ops/lib/provisioned-fields.js.
         */
        const pf = await loadProvisionedFields();
        const provisioned = readRepoSiteContent(repoRoot, slug, pf.extractContentObject);

        /** Carry the provisioned fields onto outgoing content, reporting any override made. */
        const preserveProvisioned = (c: SiteContent): SiteContent => {
          const { content: merged, applied } = pf.overlayProvisionedFields(c, provisioned);
          for (const { path, value } of applied) {
            step(`Keeping the provisioned ${path} (${String(value)}) rather than the value from the studio.`);
          }
          return merged;
        };

        // 1. Copy (or reuse) the template repo. A confirmed update refreshes the template-owned
        //    files too: the new @jdd/ui is only half an update while src/lib is the old shims.
        const existed = repoExists(repoRoot, slug);
        const overwrite = overwriteRequested || upgrade !== null;
        if (existed && !overwrite) {
          step(`Found an existing repo at clients/${slug}/repo — reusing it and refreshing components…`);
        } else if (existed && overwrite) {
          step(`Overwriting the existing repo at clients/${slug}/repo with a fresh copy of the template…`);
        } else {
          step(`Copying the blank website template into clients/${slug}/repo…`);
        }
        const copyResult = copyTemplate(repoRoot, slug, { overwrite });
        if (copyResult.preserved.length > 0) {
          step(
            `Kept ${copyResult.preserved.length} file(s) this client has customised (including ${copyResult.preserved.slice(0, 3).join(', ')}) rather than reverting them to the template.`,
          );
        }

        // 1a. Restore the routes onboard.js owns. template/ ships stale stubs of these — its
        //     contact route still targets the retired Make webhook — so a plain template copy
        //     silently replaces working lead delivery with a dead one.
        const restoredRoutes = writeOnboardRoutes(repoRoot, slug);
        if (restoredRoutes.length > 0) {
          step(
            `Wrote the ${restoredRoutes.length} provisioning-owned API routes (lead delivery + call routing) from lib/site-routes.`,
          );
        }

        // 1a1. The site-wide pieces layout.tsx must mount (smooth scrolling, the mobile call bar).
        //      layout.tsx belongs to the client, so this only ADDS what is missing, the way
        //      template/src/app/layout.tsx mounts it; see jdd-ops/lib/site-layout.js. Runs after
        //      copyTemplate so the src/lib files it imports are already in place.
        const layout = (await loadSiteLayout()).ensureSiteLayout(repoDirFor(repoRoot, slug));
        if (layout.error) {
          send({
            type: 'error',
            message: 'This site’s layout.tsx can’t be given smooth scrolling and the mobile call bar safely. Nothing was built or pushed.',
            detail: `${layout.error}\n\nThe template mounts both after {children} in template/src/app/layout.tsx.`,
            next: `Needs a developer: add <SmoothScroll /> and <StickyCallBar /> to clients/${slug}/repo/src/app/layout.tsx as the template does, then run this again.`,
          });
          return;
        }
        if (layout.added.length > 0) {
          step(`Mounted ${layout.added.join(' and ')} in src/app/layout.tsx (the rest of the layout is unchanged).`);
        }

        // 1a2. Union any new template dependencies in without dropping the client's own.
        const merged = mergePackageJson(repoRoot, slug);
        if (merged.added.length > 0) {
          step(`Added ${merged.added.length} new dependency/ies from the template: ${merged.added.join(', ')}.`);
        }

        const repoDir = repoDirFor(repoRoot, slug);
        const beat = () => send({ type: 'heartbeat', at: Date.now() });

        // 1a3. The confirmed @jdd/ui move, the way onboard.js's refreshUiPin makes it: the spec is
        //      named on the command line, because npm does not re-resolve a github: dependency
        //      when only the tag in package.json moves. This writes package.json and the lockfile
        //      and installs everything else, so step 4's plain install is skipped after it.
        let installed = false;
        if (upgrade) {
          step(`Installing @jdd/ui ${upgrade.toTag ?? upgrade.to} with a lockfile (this can take a minute)…`);
          const pinBeat = setInterval(beat, HEARTBEAT_MS);
          const pin = await runNpm({ install: upgrade.to }, repoDir, { timeoutMs: NPM_TIMEOUT_MS }).finally(
            () => clearInterval(pinBeat),
          );
          if (pin.code !== 0) {
            send({
              type: 'error',
              message: pin.timedOut
                ? `Installing @jdd/ui ${upgrade.toTag} ran for 10 minutes and was stopped. Nothing was committed or pushed.`
                : `Installing @jdd/ui ${upgrade.toTag} failed. Nothing was committed or pushed.`,
              detail: pin.tail,
              next: `The repo’s files were rewritten but nothing was committed. Check that this machine can fetch ${upgrade.to}, then run this again.`,
            });
            return;
          }
          installed = true;
          // The lock npm just wrote is what gets committed, so it must resolve the tag's commit.
          const repoLock = await verifyRepoUiLockFor(repoRoot, slug);
          for (const why of repoLock.uncheckable) step(`Note: ${why}`);
          if (repoLock.problems.length > 0) {
            send({
              type: 'error',
              message: 'The client repo’s new lockfile does not resolve the @jdd/ui version its package.json pins. Nothing was committed or pushed.',
              detail: repoLock.problems.map((p) => p.message).join('\n'),
              next: 'Nothing was pushed. Run this again; if it repeats, the tag on github.com/JuneauDigitalDesigns/jdd-ui has moved and needs a developer.',
            });
            return;
          }
          step(`@jdd/ui is now ${upgrade.toTag ?? upgrade.to} in package.json and package-lock.json.`);
        }

        // 1b. Install the content schema into the new repo. Priority: the edited content from
        //     the builder, then the vertical preset, then the studio's default schema.
        step(
          content
            ? 'Installing the edited site content…'
            : vertical
              ? `Installing the ${vertical} content preset…`
              : 'Installing the content schema…',
        );
        // Placeholder imagery is filled HERE rather than in the dialogs: this is the one
        // point both export and deploy pass through, a stale client can't bypass it, and
        // the vertical branch below gets the same treatment for free. The fill runs AFTER
        // resolveUploads so a staged upload that has since vanished — which collapses to
        // "" — lands on a placeholder instead of shipping an empty <img> to a live site.
        if (content) {
          step('Copying uploaded images into the site…');
          const { content: resolved, missing } = resolveUploads(repoRoot, slug, content);
          if (missing.length > 0) {
            step(
              `Warning: ${missing.length} uploaded image(s) are no longer staged in console/.uploads (${missing.slice(0, 3).join(', ')}) — those slots fall back to placeholder photography.`,
            );
          }
          writeSiteContent(
            repoRoot,
            slug,
            preserveProvisioned(await materialize(withPlaceholders(resolved, vertical, step))),
          );
        } else if (vertical) {
          /**
           * `presetFor`, NOT the raw `VERTICAL_PRESETS[vertical]`.
           *
           * VERTICAL_LANGUAGES is the single palette + typography authority for the bespoke
           * vertical templates (PLAN D12); `presetFor` composes it over the preset, and it is
           * what the Studio sends as `content` on the branch above. Reading the raw preset here
           * made this the one path that shipped a vertical's OLD, vestigial palette — invisible
           * for the verticals whose preset happens to sit close to its language entry, and
           * illegible for car-detailing, whose components are written for a dark ground while
           * its preset palette is still a light one.
           *
           * Not reachable from the Studio — DeployDialog and LaunchDialog both always post
           * `content` — so no shipped client site carried this. It is reachable by any direct
           * API call, which is exactly how the vertical-templates-v1 R6 acceptances drove it.
           */
          writeSiteContent(
            repoRoot,
            slug,
            preserveProvisioned(await materialize(withPlaceholders(presetFor(vertical), vertical, step))),
          );
        } else {
          // Seeds the repo from the studio's preview CONTENT. Takes the same overlay as the
          // other two branches — a preset's placeholder phone would otherwise overwrite a
          // provisioned one just as readily as an edited payload's.
          copySiteData(repoRoot, slug, preserveProvisioned);
        }

        // 2. Place each selected component.
        for (const e of entries) {
          step(`Adding the ${e.label ?? `${e.categoryId}/${e.name}`} component…`);
        }
        const written = placeComponents(repoRoot, slug, entries);

        // 2b. Fail FAST on template drift, before npm install + build spend minutes only to
        //     surface it as a TypeScript module error. A component authored against a newer
        //     console lib than the repo carries is a template problem, and saying so plainly
        //     beats making someone read a build log to work it out.
        step('Checking the components against the site’s shared libraries…');
        // Two checks, because the shared libs now live in @jdd/ui behind `export *` shims and
        // each check covers what the other structurally cannot: the symbol check reads the
        // console's node_modules, while the repo builds against its own @jdd/ui pin.
        const pins = verifyUiPinsFor(repoRoot, slug);
        for (const spec of pins.uncomparable) {
          step(`Note: “${spec}” is not a version tag, so that @jdd/ui pin could not be compared.`);
        }
        // A third check, for what the two above structurally cannot see: the LOCKFILES. A
        // package.json can pin v1.3.0 while the lock beside it still resolves the previous
        // commit, and then this export installs code the pin does not name. Network, so it
        // fails soft — an unreachable remote makes every tag uncheckable, never a pass.
        const locks = await verifyUiLockFor(repoRoot);
        for (const why of locks.uncheckable) {
          step(`Note: ${why}`);
        }
        if (locks.problems.length > 0) {
          // Its own error branch rather than folded into libProblems below, because that
          // branch's two fix texts are about a missing export and about stale repo libs, and
          // neither is the fix here. Wrong fix advice is expensive: it sends you reading the
          // wrong file, which is the whole reason this check exists.
          send({
            type: 'error',
            message:
              'A lockfile does not resolve the @jdd/ui version its package.json pins, so this export would install different code than the pin claims. Nothing was built or pushed.',
            detail:
              locks.problems.map((p) => p.message).join('\n') +
              '\n\nnpm does not re-resolve a github: dependency when only the tag moves, so editing the pin and running "npm install" is not enough — the spec has to be passed explicitly.',
            next: 'Needs a developer: the lockfile is in jdd-ops (template/ or console/), not the client repo. Once it is fixed and the console rebuilt, run this again.',
          });
          return;
        }
        const libProblems = [...verifyCatalogImports(repoRoot, slug, written), ...pins.problems];
        if (libProblems.length > 0) {
          // Two different faults wear the same symptom, and they have different fixes:
          // either the template genuinely lacks the symbol, or this repo is just carrying an
          // older copy of the shared libs (which is what `overwrite: false` preserves).
          const stale = libProblems.every((p) => p.staleRepo);
          send({
            type: 'error',
            message: stale
              ? 'This client’s repo is running older shared libraries than the template. Nothing was built or pushed.'
              : 'A component needs something the site template doesn’t provide — the template is out of date. Nothing was built or pushed.',
            detail:
              libProblems.map((p) => p.message).join('\n') +
              '\n\n' +
              (stale
                ? 'The repo’s src/lib is an older copy than template/src/lib. An export with overwrite refreshes it from the template.'
                : 'Fix: most shared libs are re-export shims of @jdd/ui — add the missing export there, tag it, and bump the "@jdd/ui" pin in both template/package.json and console/package.json. For a lib that is a real file rather than a shim, copy the missing export(s) from console/src/lib into template/src/lib. Then export again.'),
            next: stale
              ? 'Tick “Overwrite the existing repo with a fresh template copy” and run this again (Deploy always overwrites).'
              : 'Needs a developer: the template is missing what the component imports. Once it is fixed, run this again.',
          });
          return;
        }

        // 3. Wire the components into the page file(s).
        if (composition) {
          step(`Wiring ${composition.pages.length} page(s) and setting up routing…`);
          wirePages(repoRoot, slug, composition, content?.sectionStyles ?? {});
        } else {
          step('Wiring the components into the homepage and setting up imports…');
          wirePage(repoRoot, slug, entries);
        }

        // 4. Install dependencies (already done by the confirmed @jdd/ui install, when there was one).
        //    Heartbeats keep the NDJSON stream (and the client's idle watchdog) alive across a
        //    step that can legitimately run for minutes without saying anything.
        if (!installed) {
          step('Installing dependencies (this can take a minute)…');
          const installBeat = setInterval(beat, HEARTBEAT_MS);
          const install = await runNpm('install', repoDir, { timeoutMs: NPM_TIMEOUT_MS }).finally(
            () => clearInterval(installBeat),
          );
          if (install.code !== 0) {
            send({
              type: 'error',
              message: install.timedOut
                ? 'Dependency install ran for 10 minutes without finishing and was stopped. Nothing was committed or pushed.'
                : 'Dependency install failed. Nothing was committed or pushed.',
              detail: install.tail,
              next: 'Nothing was pushed. Check this machine’s network and npm access, then run this again.',
            });
            return;
          }
        }

        // 4b. The lead form and /api/contact must agree before anything is built or shipped.
        //     The route was just rewritten from lib/site-routes (step 1a), exactly as onboard.js
        //     writes it; the form is whatever @jdd/ui the repo really installed. A repo whose pin
        //     is a branch, or whose lock resolves an older commit, gets here with a mismatch.
        const pairing = checkRepoFormRoutePairing(repoDir);
        if (!pairing.ok) {
          send({
            type: 'error',
            message: 'The site’s lead form and its /api/contact route don’t match, so this would not be safe to deploy. Nothing was committed or pushed.',
            detail: pairing.reason,
            next: 'Open this client again and use “Update shared libraries” if it is offered. If it is not, the repo’s @jdd/ui pin is not a version tag and needs a developer.',
          });
          return;
        }
        step(`Checked the lead form against /api/contact: both use AI-call consent “${pairing.version}”.`);

        // 5. Build to verify it compiles.
        step('Building the site to make sure everything compiles…');
        const buildBeat = setInterval(beat, HEARTBEAT_MS);
        const build = await runNpm('run build', repoDir, { timeoutMs: NPM_TIMEOUT_MS }).finally(
          () => clearInterval(buildBeat),
        );
        if (build.code !== 0) {
          send({
            type: 'error',
            message: build.timedOut
              ? 'The build ran for 10 minutes without finishing and was stopped. Nothing was committed or pushed.'
              : 'The site was assembled but the build failed — see details below. Nothing was committed or pushed.',
            detail: build.tail,
            next: 'Nothing was pushed. Change the section or file the build log names, then run this again.',
          });
          return;
        }

        // 5b. Every local image the built pages ask for must exist. A component that uses an
        //     image field raw points at the pipeline's `/img/<hash>` base, which is not a file:
        //     the build passes and the live page shows a 404 where the photograph should be.
        const images = findMissingLocalImages(repoDir);
        if (images.pagesFound === 0) {
          step('Note: the build wrote no static pages, so local image addresses could not be checked.');
        } else if (images.missing.length > 0) {
          send({
            type: 'error',
            message: `The built site asks for ${images.missing.length} local image${images.missing.length === 1 ? '' : 's'} that ${images.missing.length === 1 ? 'doesn’t' : 'don’t'} exist. Nothing was committed or pushed.`,
            detail:
              images.missing.map((m) => `${m.ref}  (on ${m.pages.join(', ')})`).join('\n') +
              '\n\nAn address ending in a bare hash is a component using an image field without imageAt() or responsiveImage().',
            next: 'Needs a developer: route that component’s image through imageAt() (src/lib/localImage.ts), then run this again.',
          });
          return;
        }
        step(`Checked the built pages: every local image they use exists (${images.pagesFound} page${images.pagesFound === 1 ? '' : 's'}).`);

        // 6. Commit + push, so Vercel's GitHub integration redeploys the live site.
        //    Deliberately AFTER the build above: pushing something that doesn't compile
        //    would hand the failure to Vercel, where it's slower to see and harder to undo.
        if (deploy) {
          /**
           * Last line of defence against the clobber bug.
           *
           * If the repo's contact route is byte-identical to template's stub, lead delivery on
           * the live site is about to be replaced by a POST to a Make webhook nobody sets any
           * more — leads would be accepted and dropped, with nothing on the site to show for it.
           * That already shipped once. Refuse rather than push it again.
           */
          if (hasStubbedContactRoute(repoRoot, slug)) {
            send({
              type: 'error',
              message:
                'Refusing to deploy: this repo is carrying the template’s placeholder /api/contact route, which would break lead delivery on the live site.',
              detail:
                `clients/${slug}/repo/src/app/api/contact/route.ts is byte-identical to template/src/app/api/contact/route.ts.\n\n` +
                'The real route is owned by provisioning (jdd-ops/lib/site-routes/contact.route.ts). ' +
                'It should have been restored automatically — if you are seeing this, lib/site-routes is missing from the ops root.',
              next: 'Needs a developer: restore jdd-ops/lib/site-routes, then Deploy again.',
            });
            return;
          }

          /**
           * Resolve the target BEFORE touching the index.
           *
           * Two things this prevents. First, `git add -A` in a directory that isn't its own
           * repo stages an ANCESTOR repo — for clients/<slug>/repo that ancestor is jdd-ops,
           * the ops repo holding master credentials, and we would then commit and push it.
           * Second, a bare `git push` fails outright on the common provisioned state where
           * the branch has no upstream. Both are real: two of four client repos currently
           * have no .git of their own, and the one that does has no upstream configured.
           */
          const target = await resolveDeployTarget(repoDir);
          if (!target) {
            send({
              type: 'error',
              message: `clients/${slug}/repo is not a git repository, so there is nothing to deploy.`,
              next: 'The site was built but not committed. Provisioning (onboard.js) creates the GitHub repo; once it has run for this client, Deploy again.',
            });
            return;
          }
          if (target.blocker === 'not-own-repo') {
            send({
              type: 'error',
              message: 'Refusing to deploy: this folder is not its own git repository.',
              detail: `git resolves clients/${slug}/repo to ${target.toplevel}. Committing here would commit and push THAT repository, not the client's. Run \`git init\` in the client repo and set its origin — onboard.js normally does this during provisioning.`,
              next: 'Nothing was committed. Provisioning (onboard.js) gives the client repo its own git repository; once it has, Deploy again.',
            });
            return;
          }
          if (target.blocker === 'no-remote' || !target.hasRemote) {
            send({
              type: 'error',
              message: `clients/${slug}/repo has no \`origin\` remote — there is nowhere to push to.`,
              detail: 'Provisioning normally creates the GitHub repo and sets origin.',
              next: 'Nothing was committed. Once provisioning (onboard.js) has set origin for this client, Deploy again.',
            });
            return;
          }

          /**
           * Refuse a push that the remote will reject anyway.
           *
           * `behind > 0` means production has commits this repo doesn't, so `git push` fails
           * non-fast-forward. Checked here even though the dialog checks it too: the dialog's
           * copy of this state can be minutes old, and by this point the export has already
           * rewritten the repo — discovering it at the push is a much worse place to find out.
           *
           * Refused regardless of `ahead`: even at `ahead === 0`, the commit made just below
           * makes the branch diverged, and the push is rejected either way. Never force-push;
           * the remote is the live site and the local repo is not authoritative over it.
           */
          const pre = await readSyncState(repoDir, target);
          if (pre.behind > 0) {
            send({
              type: 'error',
              message: `clients/${slug}/repo is ${pre.behind} commit${pre.behind === 1 ? '' : 's'} behind origin/${target.remoteBranch}, so the push would be rejected. Nothing was committed.`,
              detail:
                `Bring the repo up to date first:\n\n` +
                `  cd clients/${slug}/repo\n` +
                `  git fetch origin\n` +
                `  git rebase origin/${target.remoteBranch}\n\n` +
                `Then deploy again.`,
              next: 'Run the three commands above, then re-check and Deploy again.',
            });
            return;
          }
          if (pre.stale) {
            step('Couldn’t reach the remote to check for new commits — pushing anyway; a rejection here means someone else pushed first.');
          }

          step('Committing the change…');
          const add = await runGit(repoDir, ['add', '-A'], { timeout: GIT_TIMEOUT_MS });
          if (add.code !== 0) {
            send({
              type: 'error',
              message: 'git add failed. Nothing was committed or pushed.',
              detail: gitTail(add),
              next: `Check clients/${slug}/repo with \`git status\` (a stale .git/index.lock is the usual cause), then Deploy again.`,
            });
            return;
          }

          // The multi-line message passes as ONE argv element. runGit uses execFile with no
          // shell, so there is nothing to quote and nothing to escape — which is precisely what
          // the old shell:true runner got wrong.
          const commit = await runGit(repoDir, ['commit', '-m', commitMessage], {
            timeout: GIT_TIMEOUT_MS,
          });
          // "nothing to commit" is a legitimate outcome: the studio state already matched
          // the repo. Treat it as success and carry on to the push.
          const commitOut = gitTail(commit);
          const nothingToCommit = /nothing to commit|working tree clean/i.test(commitOut);
          if (commit.code !== 0 && !nothingToCommit) {
            send({
              type: 'error',
              message: 'git commit failed. Nothing was pushed.',
              detail: commitOut,
              next: `Check clients/${slug}/repo with \`git status\`, then Deploy again.`,
            });
            return;
          }

          /**
           * Push with the org token in the URL, exactly as onboard.js does.
           *
           * Without it git falls back to the ambient credential helper, which on a machine set
           * up to prompt blocks forever and takes this NDJSON stream with it. `credential.helper=`
           * disables the helper entirely so there is no path back to a prompt.
           *
           * The token URL deliberately does NOT get `-u`: that would write the credential into
           * .git/config in plaintext. The upstream is set separately, afterwards, against the
           * named remote.
           *
           * Explicit refspec, never a bare `git push`. HEAD:<branch> survives the local branch
           * being named anything — client repos disagree (master here, feat/* elsewhere).
           */
          step(`Pushing to origin/${target.remoteBranch} — Vercel will pick it up from here…`);
          const token = loadGithubToken();
          const originUrl = (await runGit(repoDir, ['remote', 'get-url', 'origin'])).stdout.trim();
          const useToken = Boolean(token) && originUrl.startsWith('https://');
          const pushArgs = useToken
            ? [
                '-c',
                'credential.helper=',
                'push',
                originUrl.replace('https://', `https://${token}@`),
                `HEAD:${target.remoteBranch}`,
              ]
            : ['push', '-u', 'origin', `HEAD:${target.remoteBranch}`];

          const push = await runGit(repoDir, pushArgs, { timeout: PUSH_TIMEOUT_MS });
          if (push.code !== 0) {
            send({
              type: 'error',
              message: push.timedOut
                ? 'The push ran for two minutes without finishing and was stopped. The commit is still here locally; the live site is unchanged.'
                : 'Committed locally, but the push failed — the live site is unchanged. Check the repo’s remote and credentials.',
              detail: redact(gitTail(push), token),
              next: 'The commit is saved in the client repo. Deploy again to retry the push.',
            });
            return;
          }
          // Best-effort, non-fatal: give the branch an upstream so future runs resolve it at
          // tier 1 and never have to guess. Skipped implicitly when the fallback push used -u.
          if (useToken && target.needsUpstream) {
            await runGit(
              repoDir,
              ['branch', '--set-upstream-to', `origin/${target.remoteBranch}`],
              { timeout: GIT_TIMEOUT_MS },
            );
          }

          // Say exactly what shipped, so the operator can match it against Vercel's build.
          // Re-resolving is the cheapest way to read the new HEAD: runCommand only hands back
          // a combined output tail, which is for logs, not for parsing a sha out of.
          const after = await resolveDeployTarget(repoDir);
          const sync = after ? await readSyncState(repoDir, after) : null;
          pushed = {
            branch: target.remoteBranch,
            sha: sync?.headSha ? sync.headSha.slice(0, 7) : null,
            // The full sha, so the dialog can find this exact build in Vercel's deployment list.
            fullSha: sync?.headSha ?? null,
          };
          step(`Pushed ${pushed.sha ?? ''} to origin/${target.remoteBranch}.`);
        }

        // The repo is now the source of truth; the draft is stale.
        deleteDraft(slug);
        send({
          type: 'done',
          slug,
          deployed: deploy,
          pushed,
          repoPath: `clients/${slug}/repo`,
          components: entries.map((e) => e.label ?? `${e.categoryId}/${e.name}`),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown export error.';
        send({
          type: 'error',
          message,
          next: 'Nothing was pushed. Fix what the message names and run this again.',
        });
      } finally {
        // The SINGLE place this stream is closed. The failure branches above only `return`
        // — they used to close here too, and closing twice throws ERR_INVALID_STATE
        // ("Controller is already closed"), which Next surfaces as "failed to pipe
        // response". A long export flushed its data before the second close blew up so the
        // bug stayed invisible; a check that fails in the first 100ms kills the whole
        // response and returns a bare 500 instead of the error you needed to read.
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/**
 * Run one npm script.
 *
 * `shell: true` is REQUIRED here — npm on Windows is `npm.cmd`, and Node refuses to spawn a
 * `.cmd` without a shell. The consequence is that argv is JOINED WITH SPACES and re-parsed by
 * cmd.exe with no quoting whatsoever, so this function must NEVER be handed an argument
 * containing whitespace, quotes or a newline. Everything it receives is a source literal.
 *
 * Anything carrying a user-authored value — above all the commit message — goes through
 * `runGit` instead, which uses execFile and no shell. Passing a multi-line commit message
 * through a shell:true spawn is what broke every deploy: cmd.exe split it into eight arguments
 * and dropped everything past the first newline.
 *
 * Timeouts are enforced here rather than via spawn's own `timeout`, because spawn would signal
 * cmd.exe and leave the `node`/`next build` process beneath it running.
 */
function runNpm(
  script: 'install' | 'run build' | { install: string },
  cwd: string,
  opts: { timeoutMs: number; onOutput?: (line: string) => void },
): Promise<{ code: number; tail: string; timedOut: boolean }> {
  // The one argument that isn't a source literal: an @jdd/ui spec read from template/package.json.
  // planSharedLibUpgrade already refused anything else; this is the second lock on the same door,
  // because what follows is a shell.
  if (typeof script === 'object' && !SHELL_SAFE_ARG.test(script.install)) {
    return Promise.resolve({ code: 1, tail: `Refused to install "${script.install}".`, timedOut: false });
  }
  return new Promise((resolvePromise) => {
    // Strip NODE_ENV so it doesn't leak `development` from the dev server into the child.
    // Unset means: `npm install` still pulls devDependencies (needed to compile), and
    // `next build` sets its own `production` — mixing dev/prod React otherwise breaks
    // static prerender with a null `useContext` dispatcher.
    const { NODE_ENV: _drop, ...strippedEnv } = process.env;
    const env = strippedEnv as NodeJS.ProcessEnv;
    const args =
      typeof script === 'object' ? ['install', script.install] : script === 'install' ? ['install'] : ['run', 'build'];
    const child = spawn('npm', args, { cwd, shell: true, env, windowsHide: true });

    const lines: string[] = [];
    let timedOut = false;
    let settled = false;

    const capture = (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (!line.trim()) continue;
        lines.push(line);
        if (lines.length > 400) lines.shift();
        opts.onOutput?.(line);
      }
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);

    // Kill the whole tree. `npm` is a cmd.exe wrapper around node, so signalling the child we
    // spawned leaves the actual build running and holding the repo's files open.
    const killTree = () => {
      timedOut = true;
      if (process.platform === 'win32' && child.pid) {
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
      } else {
        child.kill('SIGKILL');
      }
    };
    const timer = setTimeout(killTree, opts.timeoutMs);

    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({ code, tail: lines.slice(-40).join('\n'), timedOut });
    };
    child.on('error', (e) => {
      lines.push(String(e));
      finish(1);
    });
    child.on('close', (code) => finish(code ?? 1));
  });
}

/**
 * Strip anything that looks like a credential out of command output.
 *
 * git echoes the remote it pushed to (`To https://<token>@github.com/org/repo.git`), and that
 * output is streamed straight to the browser in the `detail` of an error frame. Run every tail
 * through this before it leaves the server.
 */
function redact(s: string, token: string | null): string {
  let out = s.replace(/https:\/\/[^@\s/]+@/g, 'https://***@');
  if (token) out = out.split(token).join('***');
  return out;
}
