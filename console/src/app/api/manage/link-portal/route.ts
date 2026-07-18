import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { opsRoot, clientDir } from '@/lib/paths';

// Spawn `npm run onboard -- --slug {slug} --link-portal [--email addr] [--dry-run]` in the
// jdd-ops root, streaming each output line as NDJSON so the UI narrates progress live.
// Mirrors the provisioning stream in api/runbook/onboard. Linking is low-risk + idempotent
// (it only (re)writes a Clerk user's publicMetadata), so unlike onboard this defaults to a
// REAL run — the caller opts into a dry-run preview.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { slug?: string; email?: string; dryRun?: boolean };

const SLUG_RE = /^[A-Za-z0-9_-]+$/;
// Deliberately simple — a sanity gate before handing the value to onboard.js, not RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  const email = (body.email ?? '').trim();
  const dryRun = body.dryRun === true;

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
      if (email && !EMAIL_RE.test(email)) {
        send({ type: 'error', message: 'Invalid email address.' });
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

      // Guard: the client folder must have an intake schema (single or enterprise primary).
      const hasSchema =
        existsSync(resolve(clientDir(slug), 'site.ts')) ||
        existsSync(resolve(clientDir(slug), 'site-1', 'site.ts'));
      if (!hasSchema) {
        send({ type: 'error', message: `No intake at clients/${slug}/site.ts.` });
        controller.close();
        return;
      }

      const args = ['run', 'onboard', '--', '--slug', slug, '--link-portal'];
      if (email) args.push('--email', email);
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
