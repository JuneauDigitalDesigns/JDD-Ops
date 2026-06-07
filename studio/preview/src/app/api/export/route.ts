import { spawn } from 'node:child_process';
import {
  copyTemplate,
  copySiteData,
  isValidSlug,
  placeComponents,
  repoDirFor,
  repoExists,
  resolveRepoRoot,
  validateEntries,
  wirePage,
  type Entry,
} from '@/lib/export';

// Server-side export: copy the blank template into clients/<slug>/repo, drop the selected
// components in, wire them into page.tsx, then npm install + npm run build to verify.
// Streams newline-delimited JSON (NDJSON) so the UI can narrate progress in plain English.
//
// Runs in the Node runtime (fs + child_process); never static.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { slug?: string; overwrite?: boolean; selections?: Entry[] };

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

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const step = (message: string) => send({ type: 'step', message });

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
        copyTemplate(repoRoot, slug, { overwrite });

        // 1b. Install the v2.1 content schema into the new repo.
        step('Installing the content schema…');
        copySiteData(repoRoot, slug);

        // 2. Place each selected component.
        for (const e of entries) {
          step(`Adding the ${e.label ?? `${e.categoryId}/${e.name}`} component…`);
        }
        placeComponents(repoRoot, slug, entries);

        // 3. Wire imports + slots into page.tsx.
        step('Wiring the components into the homepage and setting up imports…');
        wirePage(repoRoot, slug, entries);

        const repoDir = repoDirFor(repoRoot, slug);

        // 4. Install dependencies.
        step('Installing dependencies (this can take a minute)…');
        const install = await runCommand('npm', ['install'], repoDir);
        if (install.code !== 0) {
          send({
            type: 'error',
            message: 'Dependency install failed.',
            detail: install.tail,
          });
          controller.close();
          return;
        }

        // 5. Build to verify it compiles.
        step('Building the site to make sure everything compiles…');
        const build = await runCommand('npm', ['run', 'build'], repoDir);
        if (build.code !== 0) {
          send({
            type: 'error',
            message: 'The site was assembled but the build failed — see details below.',
            detail: build.tail,
          });
          controller.close();
          return;
        }

        send({
          type: 'done',
          slug,
          repoPath: `clients/${slug}/repo`,
          components: entries.map((e) => e.label ?? `${e.categoryId}/${e.name}`),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown export error.';
        send({ type: 'error', message });
      } finally {
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

/** Run a command in cwd, returning its exit code and the tail of combined output. */
function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; tail: string }> {
  return new Promise((resolvePromise) => {
    // Strip NODE_ENV so it doesn't leak from the dev server (which sets `development`).
    // Unset means: `npm install` still pulls devDependencies (needed to compile), and
    // `next build` sets its own `production` — mixing dev/prod React otherwise breaks
    // static prerender with a null `useContext` dispatcher.
    // Omit NODE_ENV so it doesn't leak `development` from the dev server into the
    // child process. next build sets its own `production`; mixing them breaks React.
    const { NODE_ENV: _drop, ...strippedEnv } = process.env;
    const env = strippedEnv as NodeJS.ProcessEnv;
    // shell:true so Windows resolves npm.cmd; cmd/args are not user-controlled.
    const child = spawn(cmd, args, { cwd, shell: true, env });
    const lines: string[] = [];
    const capture = (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.trim()) lines.push(line);
        if (lines.length > 400) lines.shift();
      }
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', (e) => resolvePromise({ code: 1, tail: String(e) }));
    child.on('close', (code) => {
      resolvePromise({ code: code ?? 1, tail: lines.slice(-40).join('\n') });
    });
  });
}
