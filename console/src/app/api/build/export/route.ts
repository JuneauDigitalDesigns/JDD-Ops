import { spawn } from 'node:child_process';
import {
  copyTemplate,
  copySiteData,
  hasStubbedContactRoute,
  mergePackageJson,
  writeOnboardRoutes,
  writeSiteContent,
  writeVerticalSiteTs,
  isValidSlug,
  placeComponents,
  repoDirFor,
  repoExists,
  resolveRepoRoot,
  resolveUploads,
  validateEntries,
  wirePage,
  verifyCatalogImports,
  type Entry,
} from '@/lib/export';
import type { SiteContent } from '@/data/site';
import { VERTICAL_PRESETS, type VerticalId } from '@/lib/verticals';
import { resolveDeployTarget, readSyncState, runGit, type GitResult } from '@/lib/git-state';
import { loadGithubToken } from '@/lib/opsSecrets';

const VALID_VERTICALS = new Set<string>(['hvac', 'roofing', 'plumbing', 'lawn-care', 'car-detailing']);

/** npm install and next build are both legitimately slow; past this they are stuck, not slow. */
const NPM_TIMEOUT_MS = 10 * 60_000;
/** Local git plumbing is instantaneous or broken. */
const GIT_TIMEOUT_MS = 30_000;
/** The only git call that touches the network. */
const PUSH_TIMEOUT_MS = 120_000;
/** Cadence for keeping the stream (and the client's idle watchdog) alive during npm steps. */
const HEARTBEAT_MS = 10_000;

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
  vertical?: string;
  content?: unknown;
  /** Also commit + push, so Vercel's GitHub integration redeploys the live site. */
  deploy?: boolean;
  /** Written verbatim as the commit message. Required when `deploy` is set. */
  commitMessage?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  const overwrite = Boolean(body.overwrite);
  const selections = Array.isArray(body.selections) ? body.selections : [];
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
      let pushed: { branch: string; sha: string | null } | null = null;

      try {
        if (!slug) throw new Error('Choose or name a client first.');
        if (!isValidSlug(slug)) {
          throw new Error('Client name may only contain letters, numbers, hyphens and underscores.');
        }
        const entries = validateEntries(selections);
        const repoRoot = resolveRepoRoot();

        // 1. Copy (or reuse) the template repo.
        const existed = repoExists(repoRoot, slug);
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

        // 1a2. Union any new template dependencies in without dropping the client's own.
        const merged = mergePackageJson(repoRoot, slug);
        if (merged.added.length > 0) {
          step(`Added ${merged.added.length} new dependency/ies from the template: ${merged.added.join(', ')}.`);
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
        if (content) {
          step('Copying uploaded images into the site…');
          const resolved = resolveUploads(repoRoot, slug, content);
          writeSiteContent(repoRoot, slug, resolved);
        } else if (vertical) {
          writeVerticalSiteTs(repoRoot, slug, VERTICAL_PRESETS[vertical]);
        } else {
          copySiteData(repoRoot, slug);
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
        const importProblems = verifyCatalogImports(repoRoot, slug, written);
        if (importProblems.length > 0) {
          // Two different faults wear the same symptom, and they have different fixes:
          // either the template genuinely lacks the symbol, or this repo is just carrying an
          // older copy of the shared libs (which is what `overwrite: false` preserves).
          const stale = importProblems.every((p) => p.staleRepo);
          send({
            type: 'error',
            message: stale
              ? 'This client’s repo is running older shared libraries than the template. Nothing was built or pushed.'
              : 'A component needs something the site template doesn’t provide — the template is out of date. Nothing was built or pushed.',
            detail:
              importProblems.map((p) => p.message).join('\n') +
              '\n\n' +
              (stale
                ? 'Fix: export again with “overwrite” enabled — that refreshes the repo’s src/lib from template/.'
                : 'Fix: copy the missing export(s) from console/src/lib into template/src/lib, then export again.'),
          });
          return;
        }

        // 3. Wire imports + slots into page.tsx.
        step('Wiring the components into the homepage and setting up imports…');
        wirePage(repoRoot, slug, entries);

        const repoDir = repoDirFor(repoRoot, slug);

        // 4. Install dependencies.
        //    Heartbeats keep the NDJSON stream (and the client's idle watchdog) alive across a
        //    step that can legitimately run for minutes without saying anything.
        step('Installing dependencies (this can take a minute)…');
        const beat = () => send({ type: 'heartbeat', at: Date.now() });
        const installBeat = setInterval(beat, HEARTBEAT_MS);
        const install = await runNpm('install', repoDir, { timeoutMs: NPM_TIMEOUT_MS }).finally(
          () => clearInterval(installBeat),
        );
        if (install.code !== 0) {
          send({
            type: 'error',
            message: install.timedOut
              ? 'Dependency install ran for 10 minutes without finishing and was stopped. Nothing was committed or pushed.'
              : 'Dependency install failed.',
            detail: install.tail,
          });
          return;
        }

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
              : 'The site was assembled but the build failed — see details below.',
            detail: build.tail,
          });
          return;
        }

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
            });
            return;
          }
          if (target.blocker === 'not-own-repo') {
            send({
              type: 'error',
              message: 'Refusing to deploy: this folder is not its own git repository.',
              detail: `git resolves clients/${slug}/repo to ${target.toplevel}. Committing here would commit and push THAT repository, not the client's. Run \`git init\` in the client repo and set its origin — onboard.js normally does this during provisioning.`,
            });
            return;
          }
          if (target.blocker === 'no-remote' || !target.hasRemote) {
            send({
              type: 'error',
              message: `clients/${slug}/repo has no \`origin\` remote — there is nowhere to push to.`,
              detail: 'Provisioning normally creates the GitHub repo and sets origin.',
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
            });
            return;
          }
          if (pre.stale) {
            step('Couldn’t reach the remote to check for new commits — pushing anyway; a rejection here means someone else pushed first.');
          }

          step('Committing the change…');
          const add = await runGit(repoDir, ['add', '-A'], { timeout: GIT_TIMEOUT_MS });
          if (add.code !== 0) {
            send({ type: 'error', message: 'git add failed.', detail: gitTail(add) });
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
            send({ type: 'error', message: 'git commit failed.', detail: commitOut });
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
          };
          step(`Pushed ${pushed.sha ?? ''} to origin/${target.remoteBranch}.`);
        }

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
        send({ type: 'error', message });
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
  script: 'install' | 'run build',
  cwd: string,
  opts: { timeoutMs: number; onOutput?: (line: string) => void },
): Promise<{ code: number; tail: string; timedOut: boolean }> {
  return new Promise((resolvePromise) => {
    // Strip NODE_ENV so it doesn't leak `development` from the dev server into the child.
    // Unset means: `npm install` still pulls devDependencies (needed to compile), and
    // `next build` sets its own `production` — mixing dev/prod React otherwise breaks
    // static prerender with a null `useContext` dispatcher.
    const { NODE_ENV: _drop, ...strippedEnv } = process.env;
    const env = strippedEnv as NodeJS.ProcessEnv;
    const args = script === 'install' ? ['install'] : ['run', 'build'];
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
