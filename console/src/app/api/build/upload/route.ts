import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

// Stages an image uploaded from the Brand drawer into console/.uploads and returns an
// "upload://<id>.<ext>" ref. At export, resolveUploads() copies the staged file into
// clients/<slug>/repo/public/images and rewrites the ref to "/images/<id>.<ext>".
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGE_DIR = resolve(process.cwd(), '.uploads');
const OK = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'No file.' }, { status: 400 });
  const ext = (extname(file.name) || '.png').toLowerCase();
  if (!OK.has(ext)) return Response.json({ error: 'Unsupported image type.' }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: 'Max 8 MB.' }, { status: 400 });

  mkdirSync(STAGE_DIR, { recursive: true });
  const id = `${randomUUID()}${ext}`;
  writeFileSync(resolve(STAGE_DIR, id), Buffer.from(await file.arrayBuffer()));
  return Response.json({ ref: `upload://${id}` });
}
