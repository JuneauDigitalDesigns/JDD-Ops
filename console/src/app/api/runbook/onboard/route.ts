import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { opsRoot, clientDir } from '@/lib/paths';

// Spawn `npm run onboard -- --schema clients/{slug}/site.ts [--dry-run]` in the jdd-ops
// root, streaming each output line as NDJSON so the UI narrates progress live. Mirrors the
// streaming pattern in studio/preview's export route. Real runs provision real resources —
// the UI gates them behind an explicit confirm; this route defaults to dry-run when unset.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { slug?: string; dryRun?: boolean };

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  // Default to a dry run unless the caller explicitly asks for a real one.
  const dryRun = body.dryRun !== false;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      // Validate before spawning.
      if (!slug || !SLUG_RE.test(slug)) {
        send({ type: 'error', message: 'Invalid or missing client slug.' });
        controller.close();
        return;
      }

      let root: string;
      try {
        root = opsRoot();
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Cannot locate jdd-ops.' });
        controller.close();
        return;
      }

      const schemaRel = `clients/${slug}/site.ts`;
      if (!existsSync(resolve(clientDir(slug), 'site.ts'))) {
        send({ type: 'error', message: `No intake at ${schemaRel}.` });
        controller.close();
        return;
      }

      const args = ['run', 'onboard', '--', '--schema', schemaRel];
      if (dryRun) args.push('--dry-run');

      send({ type: 'start', dryRun, command: `npm ${args.join(' ')}` });

      // Strip NODE_ENV so it doesn't leak the dev server's "development" into the child.
      const { NODE_ENV: _drop, ...strippedEnv } = process.env;
      // shell:true so Windows resolves npm.cmd; args are validated/not user-controlled.
      const child = spawn('npm', args, { cwd: root, shell: true, env: strippedEnv as NodeJS.ProcessEnv });

      let buffer = '';
      const flush = (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.length) send({ type: 'log', line });
        }
      };
      child.stdout.on('data', flush);
      child.stderr.on('data', flush);
      child.on('error', (e) => {
        send({ type: 'error', message: String(e) });
        controller.close();
      });
      child.on('close', (code) => {
        if (buffer.trim()) send({ type: 'log', line: buffer });
        send({ type: 'exit', code: code ?? 1 });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
