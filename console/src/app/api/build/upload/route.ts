import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { checkUpload } from '@/lib/uploadCheck';

// Stages an image uploaded in the console (the intake's service photos, the Studio's image tiles,
// the Brand drawer) into console/.uploads and returns an "upload://<id>.<ext>" ref. At export the
// image pipeline encodes it like every other photo (lib/image-pipeline.ts).
//
// The file is checked for what it IS before anything is staged (lib/uploadCheck.ts): a real,
// decodable JPEG, PNG, WebP, AVIF or GIF, or SVG for the logo only. A renamed non-image used to stage
// fine and only fail at export (Xander 2026-11-12).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGE_DIR = resolve(process.cwd(), '.uploads');

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'No file.' }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: 'Max 8 MB.' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  // The caller says which field the image is for; SVG is accepted for the logo alone, as before.
  const check = await checkUpload(buf, file.name, { allowSvg: form.get('path') === 'images.footer.logoImage' });
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });

  mkdirSync(STAGE_DIR, { recursive: true });
  const id = `${randomUUID()}${check.ext}`;
  writeFileSync(resolve(STAGE_DIR, id), buf);
  return Response.json({ ref: `upload://${id}` });
}
