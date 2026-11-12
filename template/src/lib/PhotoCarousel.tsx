'use client';
// Photo carousels (Xander 2026-11-11): "If more than 1 work photo is provided, then it should go along
// with the rest of the work photos ... in a carousel." He chose both places, and that the visitor
// moves them (no autoplay):
// - HeroPhotos: the home hero shows the general work photos (images.hero.slides), photo 1 first,
//   with a small previous / dots / next control. A crossfade on the visitor's click; none under
//   reduced motion.
// - WorkCarousel: a service page's "Our work" shows that service's own photos in a swipeable track
//   (CSS scroll snap, so touch, trackpad and keyboard scrolling work with no script), with the same
//   control under it.
//
// Speed: only photo 1 is in the server HTML, and it alone is `priority` (the LCP). The other hero
// photos mount after the page has loaded and are lazy; track photos are lazy. One photo: no control.
//
// The control's words are heard, not seen (aria labels). Approved word for word by Xander, 2026-11-11.
//
// BYTE-IDENTICAL in console/src/lib and template/src/lib (console/test/photo-carousel.test.mjs).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { CoverImage } from '@/lib/CoverImage';

export const CAROUSEL_WORDS = {
  photos: 'Photos',
  previous: 'Previous photo',
  next: 'Next photo',
  /** "Photo 2 of 3" */
  position: (n: number, of: number) => `Photo ${n} of ${of}`,
} as const;

export type CarouselPhoto = { url: string; alt: string };

const stillPreferred = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Previous, one dot per photo, next. Tone: `onDark` over a photo, `onLight` on the page. */
function Controls({
  count,
  index,
  go,
  tone,
  className = '',
}: {
  count: number;
  index: number;
  go: (i: number) => void;
  tone: 'onDark' | 'onLight';
  className?: string;
}) {
  const W = CAROUSEL_WORDS;
  const shell =
    tone === 'onDark'
      ? 'bg-[color:color-mix(in_srgb,var(--ink-panel)_62%,transparent)] text-onInk backdrop-blur-sm'
      : 'border border-rule bg-bg text-ink';
  const btn = `grid h-9 w-9 place-items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
    tone === 'onDark' ? 'hover:bg-[color:color-mix(in_srgb,var(--on-ink)_14%,transparent)]' : 'hover:bg-bgSoft'
  }`;
  return (
    <div className={`flex items-center gap-1 rounded-full p-1 ${shell} ${className}`}>
      <button type="button" aria-label={W.previous} className={btn} onClick={() => go((index - 1 + count) % count)}>
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
      </button>
      <div className="flex items-center gap-1 px-1">
        {Array.from({ length: count }, (_, k) => (
          <button
            key={k}
            type="button"
            aria-label={W.position(k + 1, count)}
            aria-current={k === index ? 'true' : undefined}
            onClick={() => go(k)}
            className="grid h-6 w-5 place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span
              className={`block h-2 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                k === index ? 'w-4 bg-accent' : `w-2 ${tone === 'onDark' ? 'bg-[color:color-mix(in_srgb,var(--on-ink)_55%,transparent)]' : 'bg-rule'}`
              }`}
            />
          </button>
        ))}
      </div>
      <button type="button" aria-label={W.next} className={btn} onClick={() => go((index + 1) % count)}>
        <CaretRight size={16} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * The hero's photo layer, as a crossfade, plus its control. Render it where the hero's single photo
 * layer was (`absolute inset-0` inside the hero). The control is positioned by `controlsClassName`
 * against the hero itself (e.g. `bottom-5 left-5`), above the hero's content, so each trade puts it
 * where it covers no text or form.
 */
export function HeroPhotos({
  photos,
  position,
  controlsClassName,
  layerStyle,
}: {
  photos: CarouselPhoto[];
  /** object-position, as the single photo had it. */
  position?: string;
  controlsClassName: string;
  /** Anything the old photo layer carried (e.g. a grade filter). */
  layerStyle?: CSSProperties;
}) {
  const [index, setIndex] = useState(0);
  // Photos 2+ mount once the page has loaded, so they never compete with photo 1 (the LCP).
  const [rest, setRest] = useState(false);
  useEffect(() => {
    const show = () => setRest(true);
    if (document.readyState === 'complete') { const t = window.setTimeout(show, 300); return () => window.clearTimeout(t); }
    window.addEventListener('load', show, { once: true });
    return () => window.removeEventListener('load', show);
  }, []);
  if (photos.length === 0) return null;
  const many = photos.length > 1;
  return (
    <>
      <div
        className="absolute inset-0 isolate overflow-hidden"
        style={layerStyle}
        {...(many ? { role: 'group', 'aria-roledescription': 'carousel', 'aria-label': CAROUSEL_WORDS.photos } : {})}
      >
        {photos.map((p, k) =>
          k === 0 || rest ? (
            <div
              key={p.url + k}
              className="absolute inset-0 isolate transition-opacity duration-700 ease-out motion-reduce:transition-none"
              style={{ opacity: k === index ? 1 : 0 }}
              aria-hidden={k === index ? undefined : true}
            >
              <CoverImage url={p.url} alt={p.alt} sizes="100vw" avif priority={k === 0} position={position} />
            </div>
          ) : null,
        )}
      </div>
      {many && (
        <Controls count={photos.length} index={index} go={setIndex} tone="onDark" className={`absolute z-[5] ${controlsClassName}`} />
      )}
    </>
  );
}

/**
 * "Our work" on a service page: one photo as a single framed photo, more as a swipeable track with
 * the control under it. `frame` is the trade's own figure classes (corners, shadow), `aspect` its ratio.
 */
export function WorkCarousel({
  photos,
  frame,
  aspect = 'aspect-[3/2]',
  sizes = '(min-width: 1120px) 1072px, 100vw',
  after,
}: {
  photos: CarouselPhoto[];
  frame: string;
  aspect?: string;
  sizes?: string;
  /** Anything the trade draws over each photo (rarely needed). */
  after?: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (photos.length === 0) return null;
  const figure = (p: CarouselPhoto, k: number, extra = '') => (
    <figure key={p.url + k} className={`relative isolate overflow-hidden ${aspect} ${frame} ${extra}`}>
      <CoverImage url={p.url} alt={p.alt} sizes={sizes} />
      {after}
    </figure>
  );
  if (photos.length === 1) return figure(photos[0], 0);

  const go = (k: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: k * el.clientWidth, behavior: stillPreferred() ? 'auto' : 'smooth' });
    setIndex(k);
  };
  return (
    <div role="group" aria-roledescription="carousel" aria-label={CAROUSEL_WORDS.photos}>
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (k !== index) setIndex(k);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        tabIndex={0}
        aria-label={CAROUSEL_WORDS.position(index + 1, photos.length)}
      >
        {photos.map((p, k) => (
          <div key={p.url + k} className="w-full shrink-0 snap-center" aria-hidden={k === index ? undefined : true}>
            {figure(p, k)}
          </div>
        ))}
      </div>
      <Controls count={photos.length} index={index} go={go} tone="onLight" className="mx-auto mt-4 w-fit" />
    </div>
  );
}

/**
 * The home hero's photos: the general work photos (`images.hero.slides`), photo 1 first; else the
 * single `portrait`. A photo that came without words gets `fallbackAlt` (facts only).
 */
export function heroPhotos(content: unknown, fallbackAlt: string): CarouselPhoto[] {
  const hero = ((content as { images?: { hero?: { slides?: unknown; portrait?: unknown } } })?.images?.hero) ?? {};
  const slides = (Array.isArray(hero.slides) ? hero.slides : [])
    .map((x) => (x && typeof x === 'object' ? (x as { url?: unknown; alt?: unknown }) : {}))
    .map((x) => ({ url: typeof x.url === 'string' ? x.url.trim() : '', alt: typeof x.alt === 'string' ? x.alt.trim() : '' }))
    .filter((x) => x.url)
    .map((x) => ({ url: x.url, alt: x.alt || fallbackAlt }));
  if (slides.length) return slides;
  const portrait = typeof hero.portrait === 'string' ? hero.portrait.trim() : '';
  return portrait ? [{ url: portrait, alt: fallbackAlt }] : [];
}
