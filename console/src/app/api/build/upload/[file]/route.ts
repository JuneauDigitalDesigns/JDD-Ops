import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isStagedFileName } from '@/lib/stagedUploads';

// Serves a staged upload (console/.uploads/<uuid>.<ext>) so the intake and the Studio can show it
// before export (lib/stagedUploads.ts). Only a UUID file name with an image extension is accepted:
// no paths, no other files. The console binds 127.0.0.1 only.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGE_DIR = resolve(process.cwd(), '.uploads');
const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml',
};

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const file = (params.file ?? '').toLowerCase();
  if (!isStagedFileName(file)) return new Response('Not found', { status: 404 });
  const path = resolve(STAGE_DIR, file);
  if (!existsSync(path)) return new Response('Not found', { status: 404 });
  return new Response(readFileSync(path), {
    headers: {
      'Content-Type': TYPES[file.split('.').pop() ?? ''] ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // An uploaded SVG opened directly runs nothing.
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
    },
  });
}
