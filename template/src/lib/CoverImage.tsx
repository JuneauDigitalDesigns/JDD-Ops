// A client photo that fills its box: what every catalog component uses where it used to paint the
// photo as a CSS background (Xander 2026-11-11: client photos must load fast and not cost SEO).
//
// A CSS background-image is invisible to the browser's preload scanner, takes one fixed width (a
// phone downloaded the 1536px file), gets no AVIF, and can't be lazy. This is a real <img> (in a
// <picture> when the export localized it) with:
// - srcset over the widths the pipeline wrote and a `sizes` the caller states;
// - AVIF first where the pipeline wrote it (the hero slots only, image-pipeline.ts AVIF_RATIO_KEYS);
// - `priority`: eager + fetchpriority="high" for the one above-the-fold photo (the LCP), lazy
//   otherwise;
// - explicit width/height for the intrinsic ratio, and it fills a parent that already has its size,
//   so it never shifts layout.
// It sits at -z-10, and the parent is made `isolate`, so the parent's own overlays and text stay
// above it.
//
// BYTE-IDENTICAL in console/src/lib and template/src/lib (console/test/image-performance.test.mjs).
import { responsiveImage, responsivePicture } from '@/lib/img';

export function CoverImage({
  url,
  alt,
  sizes,
  priority = false,
  avif = false,
  position = 'object-center',
  className = '',
}: {
  url: string | null | undefined;
  /** Real words about the photo, or '' when it is decoration beside text that says the same. */
  alt: string;
  /** How wide it renders, e.g. "100vw" or "(min-width: 1024px) 50vw, 100vw". */
  sizes: string;
  /** The above-the-fold photo: load first, never lazy. One per page. */
  priority?: boolean;
  /** Only for slots the pipeline writes AVIF for (the hero). Elsewhere it would point at no file. */
  avif?: boolean;
  /** An object-position class, e.g. `object-[62%_50%]`, matching the old background-position. */
  position?: string;
  className?: string;
}) {
  if (!url) return null;
  const img = {
    alt,
    sizes,
    width: 1536,
    height: 960,
    loading: priority ? ('eager' as const) : ('lazy' as const),
    decoding: 'async' as const,
    ...(priority ? { fetchPriority: 'high' as const } : {}),
    className: `absolute inset-0 -z-10 h-full w-full object-cover ${position} ${className}`,
  };
  const pic = responsivePicture(url, { avif });
  if (pic.webpSrcSet) {
    return (
      <picture>
        {pic.avifSrcSet && <source type="image/avif" srcSet={pic.avifSrcSet} sizes={sizes} />}
        <source type="image/webp" srcSet={pic.webpSrcSet} sizes={sizes} />
        <img src={pic.src} {...img} />
      </picture>
    );
  }
  // The Studio preview: an origin URL, resized by the host when we know how (responsiveImage).
  const r = responsiveImage(url);
  return <img src={r.src} srcSet={r.srcSet} {...img} />;
}
