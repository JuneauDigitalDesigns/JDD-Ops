import 'server-only';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { SiteContent } from '@/data/site';
import { repoDirFor } from '@/lib/export';

/**
 * The build-time image pipeline (Phase 11). Fetches each client/stock image ONCE at export,
 * emits WebP at four widths (plus AVIF for the hero) into the client repo's /public/img, kills
 * the third-party hotlink, and enforces one aspect ratio and one grade so mixed sources read as
 * one professional set (decision 15). It rewrites every image slot to `/img/<hash>` (the base the
 * @jdd/ui img.ts local-asset branch keys off) and records `_meta.local_images` so a localized
 * placeholder stays distinguishable from a real client photo on re-export (decision 39).
 *
 * SERVER-ONLY and export-time only: `sharp` is a console devDependency, so client repos stay
 * dependency-free and only ever serve the emitted files.
 */

/** The one enforced ratio per slot kind (decision 15; photography.md section 4). */
export const RATIOS = { hero: 16 / 10, aboutFeature: 4 / 5, service: 3 / 2, work: 3 / 2, avatar: 1 } as const;
type RatioKey = keyof typeof RATIOS;

/**
 * FOUR widths, WebP everywhere, AVIF for the HERO slot only (decision 44). Not five widths in two
 * formats: egress is not the constraint on Vercel Pro (decision 52), but EXPORT DURATION is, and
 * AVIF encode is the slow step. AVIF is reserved for the LCP hero where its compression pays off.
 *
 * KEEP IN LOCKSTEP with packages/ui/src/img.ts's WIDTHS: a width named in a component srcSet that
 * this pipeline never emitted is a 404 on a live client site.
 */
export const WIDTHS = [640, 1024, 1536, 2048] as const;
/** The only ratio key that also gets AVIF, keyed by ratio (not path) so every hero slot qualifies. */
export const AVIF_RATIO_KEYS: readonly RatioKey[] = ['hero'];

type Slot = {
  get: () => string | undefined;
  set: (v: string) => void;
  ratioKey: RatioKey;
  /** Logos skip the crop and the grade (never recolour a logo); resize bounds the long edge only. */
  isLogo?: boolean;
};

/** Every image slot fillImagePlaceholders writes, as get/set accessors onto the cloned content. */
function collectSlots(c: SiteContent): Slot[] {
  const slots: Slot[] = [];
  const imgs = c.images;
  if (imgs?.hero) {
    slots.push({ ratioKey: 'hero', get: () => imgs.hero.portrait, set: (v) => { imgs.hero.portrait = v; } });
    const slides = imgs.hero.slides;
    if (Array.isArray(slides)) {
      slides.forEach((_, i) => slots.push({ ratioKey: 'hero', get: () => slides[i]?.url, set: (v) => { slides[i].url = v; } }));
    }
  }
  if (imgs?.about) {
    slots.push({ ratioKey: 'aboutFeature', get: () => imgs.about.feature, set: (v) => { imgs.about.feature = v; } });
  }
  const items = c.services?.items;
  if (Array.isArray(items)) {
    items.forEach((_, i) => slots.push({
      ratioKey: 'service',
      get: () => items[i]?.image?.url,
      set: (v) => { items[i].image!.url = v; },
    }));
  }
  const projects = c.work?.projects;
  if (Array.isArray(projects)) {
    projects.forEach((_, i) => slots.push({
      ratioKey: 'work',
      get: () => projects[i]?.image?.url,
      set: (v) => { projects[i].image!.url = v; },
    }));
  }
  const avatars = imgs?.testimonials?.avatars;
  if (Array.isArray(avatars)) {
    avatars.forEach((_, i) => slots.push({ ratioKey: 'avatar', get: () => avatars[i], set: (v) => { avatars[i] = v; } }));
  }
  if (imgs?.footer) {
    slots.push({ ratioKey: 'avatar', isLogo: true, get: () => imgs.footer.logoImage, set: (v) => { imgs.footer.logoImage = v; } });
  }
  return slots;
}

/** Fetch one URL, emit its widths/formats under outDir, and return the `/img/<hash>` base. */
async function processOne(url: string, slot: Slot, outDir: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16);
  const ratio = RATIOS[slot.ratioKey];
  const wantAvif = AVIF_RATIO_KEYS.includes(slot.ratioKey) && !slot.isLogo;

  for (const w of WIDTHS) {
    // A fresh decode per width keeps each output independent; `withoutEnlargement` means a source
    // smaller than a width is never upscaled (pixels never exceed the source, honouring the plan)
    // while the file is still emitted at every width name so a component srcSet never 404s.
    const base = slot.isLogo
      // Logo: no crop, no grade, no recolour; bound the long edge to w.
      ? sharp(buf).resize(w, w, { fit: 'inside', withoutEnlargement: true })
      : sharp(buf)
          .resize(w, Math.round(w / ratio), { fit: 'cover', position: 'attention', withoutEnlargement: true })
          // ONE fixed grade, two passes (decision 15/55): saturation pull + contrast lift. No tint
          // pass - decision 9 already warms the ground, and a tint on top pushes the page to sepia.
          .modulate({ saturation: 0.88, brightness: 1.02 })
          .linear(1.04, -6);
    await base.clone().webp({ quality: 80 }).toFile(join(outDir, `${hash}-${w}.webp`));
    if (wantAvif) await base.clone().avif({ quality: 55 }).toFile(join(outDir, `${hash}-${w}.avif`));
  }
  return `/img/${hash}`;
}

/**
 * Localize every absolute image URL in `content` into the client repo's /public/img, rewriting
 * each slot to `/img/<hash>` and recording the original -> localized mapping at
 * `_meta.local_images` (MERGED onto any mapping a prior export left, never replaced).
 *
 * Never throws: a fetch or encode failure leaves that slot's original URL in place, records it in
 * `failed`, and warns via `step`. A placeholder photo must never fail a deploy.
 */
export async function materializeImages(
  repoRoot: string,
  slug: string,
  content: SiteContent,
  step: (m: string) => void,
): Promise<{ content: SiteContent; localized: string[]; failed: string[] }> {
  const c: SiteContent = structuredClone(content);
  const outDir = join(repoDirFor(repoRoot, slug), 'public', 'img');
  await mkdir(outDir, { recursive: true });

  const mapping: Record<string, string> = { ...(c._meta.local_images ?? {}) };
  const localized: string[] = [];
  const failed: string[] = [];
  const done = new Map<string, string>(); // original URL -> base, so a reused photo encodes once

  for (const slot of collectSlots(c)) {
    const url = slot.get();
    if (!url || !/^https?:\/\//i.test(url)) continue; // already local, relative, or empty
    const cached = done.get(url);
    if (cached) { slot.set(cached); continue; }
    try {
      const localBase = await processOne(url, slot, outDir);
      slot.set(localBase);
      mapping[url] = localBase;
      done.set(url, localBase);
      localized.push(url);
    } catch {
      failed.push(url);
      step(`Warning: could not localize an image (${url.slice(0, 60)}) - it will be hotlinked.`);
    }
  }

  c._meta = { ...c._meta, local_images: mapping };
  return { content: c, localized, failed };
}
