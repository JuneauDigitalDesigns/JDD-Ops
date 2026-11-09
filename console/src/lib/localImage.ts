// One image URL a browser can actually fetch, for places a srcset can't go: a CSS
// background-image, or an <img> that takes a single src.
//
// The export pipeline (console/src/lib/image-pipeline.ts) rewrites every image field to a
// localized BASE, `/img/<hash>`, and writes `<hash>-<width>.webp` files beside it. The base itself
// is not a file. @jdd/ui's responsiveImage/responsivePicture expand it for <img srcSet>; anything
// that used the field raw — `url(${slide})`, `src={p.image.url}` — pointed at a path that 404s.
// That is how `_e2e_test_growth` went live with no hero photograph (2026-11-09).
//
// A copy of this file lives at template/src/lib/localImage.ts, byte for byte, because catalog
// components import '@/lib/localImage' in the console preview and in every client repo.
// console/test/local-images.test.mjs keeps the two equal and the widths in step with the pipeline.

/** The widths the export pipeline writes. KEEP IN LOCKSTEP with image-pipeline.ts's WIDTHS. */
export const LOCAL_IMAGE_WIDTHS = [640, 1024, 1536, 2048] as const;
export type LocalImageWidth = (typeof LOCAL_IMAGE_WIDTHS)[number];

/** A localized base from the pipeline: `/img/<hash>`, with no width and no extension. */
export const isLocalImageBase = (url: string): boolean => url.startsWith('/img/') && !/\.[a-z0-9]+$/i.test(url);

/**
 * `url` as a fetchable address: a localized base becomes its `<width>.webp` file; anything else
 * (an origin URL in the console preview, an already-concrete path) is returned unchanged.
 */
export function imageAt(url: string | null | undefined, width: LocalImageWidth): string {
  if (!url) return '';
  return isLocalImageBase(url) ? `${url}-${width}.webp` : url;
}
