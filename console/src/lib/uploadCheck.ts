/**
 * What an uploaded file really is (Xander 2026-11-12: "fix the JPEG extension issue. We should be
 * catching that when it uploads").
 *
 * /api/build/upload used to trust the file name: a text file named .jpg staged fine, and the operator
 * only found out at export, when the image pipeline couldn't read it. Now the first bytes must be a
 * JPEG, PNG, WebP, AVIF or GIF signature (or SVG text, for the logo only, as before), and sharp, the
 * library the export's pipeline encodes with, must decode it. The file is stored under the extension
 * of what it really is, whatever it was called.
 *
 * The refusal reuses the route's existing words, "Unsupported image type.". No new wording.
 *
 * No `server-only` here, so the tests can call it; only the upload route imports it.
 */
import sharp from 'sharp';
import { MAX_INPUT_PIXELS } from '@/lib/image-encode';

export type UploadCheck = { ok: true; ext: string } | { ok: false; error: string };

const UNSUPPORTED = 'Unsupported image type.';

const startsWith = (buf: Buffer, bytes: number[], at = 0) => bytes.every((b, i) => buf[at + i] === b);
const ascii = (buf: Buffer, from: number, to: number) => buf.subarray(from, to).toString('latin1');

/** The image type the bytes say they are, by signature, or null. */
export function sniffImage(buf: Buffer): '.jpg' | '.png' | '.webp' | '.avif' | '.gif' | '.svg' | null {
  if (buf.length >= 3 && startsWith(buf, [0xff, 0xd8, 0xff])) return '.jpg';
  if (buf.length >= 8 && startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return '.png';
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return '.webp';
  if (buf.length >= 12 && ascii(buf, 4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(buf, 8, 12))) return '.avif';
  if (buf.length >= 6 && /^GIF8[79]a$/.test(ascii(buf, 0, 6))) return '.gif';
  const head = buf.subarray(0, 1024).toString('utf8');
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return '.svg';
  return null;
}

/**
 * Accept the upload only if it is a real, decodable image. `name` is the file's name, used for
 * nothing but the error-free path: the stored extension is always the detected one.
 */
export async function checkUpload(buf: Buffer, _name: string, opts: { allowSvg: boolean }): Promise<UploadCheck> {
  const ext = sniffImage(buf);
  if (!ext || (ext === '.svg' && !opts.allowSvg)) return { ok: false, error: UNSUPPORTED };
  try {
    // Decode it, the way the export will (a header-only read would pass a truncated file).
    await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS }).rotate().resize(32, 32, { fit: 'inside' }).toBuffer();
  } catch {
    return { ok: false, error: UNSUPPORTED };
  }
  return { ok: true, ext };
}
