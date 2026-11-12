/**
 * Staged uploads, as the console shows them before export.
 *
 * An image uploaded in the intake (a service's photos) or the Brand drawer is staged in
 * console/.uploads and stored as `upload://<id>.<ext>`; the export copies it into the client's repo
 * (lib/export.ts resolveUploads). Nothing could show that ref before export: thumbnails hid it and
 * the Studio drew a broken image, so a photo looked lost the moment it was added (Xander
 * 2026-11-12; the same two photos were staged twice, four minutes apart).
 *
 * `previewSrc` gives an address the console serves (GET /api/build/upload/<file>). The Studio maps
 * refs for its preview only (`withStagedPreviews`); the draft, the copy run and the export keep the
 * `upload://` ref. Client repos never see either.
 *
 * CLIENT-SAFE: no Node imports (BuildWizard and the intake are 'use client').
 */
const PREFIX = 'upload://';

/** The staged file name the upload route writes: a UUID and an image extension, nothing else. */
const STAGED_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif|gif|svg)$/;

/** The file name in `upload://<file>`, or null when it isn't a well-formed staged ref. */
export function stagedFileName(ref: unknown): string | null {
  if (typeof ref !== 'string' || !ref.startsWith(PREFIX)) return null;
  const file = ref.slice(PREFIX.length).toLowerCase();
  return STAGED_FILE.test(file) ? file : null;
}

/** True for a request param naming a staged file (guards the GET route: no paths, no dots). */
export const isStagedFileName = (file: string): boolean => STAGED_FILE.test(file);

/** An address a browser can load for an image value: staged refs via the console, URLs as they are, else null. */
export function previewSrc(value: unknown): string | null {
  const file = stagedFileName(value);
  if (file) return `/api/build/upload/${file}`;
  return typeof value === 'string' && /^(https?:\/\/|\/)/.test(value) ? value : null;
}

/** `content` with every staged ref replaced by its preview address. Same object when there is none. */
export function withStagedPreviews<T>(content: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const file = stagedFileName(v);
      return file ? `/api/build/upload/${file}` : v;
    }
    if (Array.isArray(v)) {
      const next = v.map(walk);
      return next.some((x, i) => x !== v[i]) ? next : v;
    }
    if (v && typeof v === 'object') {
      let changed = false;
      const next: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        next[k] = walk(x);
        if (next[k] !== x) changed = true;
      }
      return changed ? next : v;
    }
    return v;
  };
  return walk(content) as T;
}
