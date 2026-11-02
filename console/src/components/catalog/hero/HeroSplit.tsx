'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HeroSplit — premium full-bleed recomposition (2026-10 visual upgrade).
//
// Was an image-led two-column split (copy + a contained photo behind an offset accent slab),
// with hero.heroBullets rendered as a flat full-width accent BAND at the bottom. The upgrade
// (approved mockup, "Home — Standard"):
//   • The photograph goes FULL-BLEED behind the copy under a flat dark scrim — taller, more
//     confident, the reference-site hero.
//   • hero.heroBullets are lifted out of the flat accent band into premium STAT TILES on a soft
//     band below the hero (same {value,label} data — no schema change).
//   • Headings render in the condensed display face (var(--font-heading) = Oswald by default).
//
// LCP DISCIPLINE IS PRESERVED. SPEC §9 / the original file forbid gating the above-fold LCP
// text behind an entrance animation. The old sin was framer-motion (paint waited on hydration).
// The stagger here is pure CSS (paints without JS), AND it is applied ONLY to decorative/
// secondary elements (rating, CTAs, friction list, tiles). The H1 and the sub paragraph — the
// LCP candidates — carry NO animation and paint immediately. framer-motion is still not imported.
//
// The scrim is a FLAT plate (two measured linear gradients), not a feathered directional
// vignette — decision 30(b) names the soft-gradient-over-photo as the most-cited AI tell.
// ─────────────────────────────────────────────────────────────────────────────
import { PhoneCall, CheckCircle, Star, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E, useEditing } from '@/lib/editable';
import { responsiveImage, responsivePicture } from '@/lib/img';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'hero-split',
  category: 'hero',
  label: 'Hero / Image-led split',
  consumes: [
    'hero.eyebrow', 'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.badge',
    'hero.cta', 'hero.secondaryCta', 'hero.frictionReducers', 'hero.heroBullets',
    'brand.phoneHref', 'brand.phone', 'brand.short', 'brand.name',
    'images.hero.slides', 'extensions.reviewBadge',
  ],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins'],
  skins: ['default', 'inverted'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'asymmetric-split',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
} as const;

/** Splits the headline so the emphasised phrase can carry the accent, without animation. */
function Headline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const i = text.indexOf(emphasis);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-accent">{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export default function HeroSplit({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const editing = useEditing();
  const { hero, brand, images, extensions } = content;
  const slide = images.hero.slides?.[0];
  // The hero is the LCP image and the one slot the export pipeline emits AVIF for (decision 44).
  // Non-null only after export localizes the slot to /img/<hash>; in the console preview (an origin
  // URL) webpSrcSet is undefined and the responsiveImage fallback below renders instead.
  const heroPic = slide?.url ? responsivePicture(slide.url, { avif: true }) : null;
  const review = extensions.reviewBadge;

  // Brand-tinted depth: a navy (accent2) shadow rather than a neutral grey one. color-mix keeps
  // it derived from the live token, so a per-section accent2 edit recolours the tiles' depth too.
  const tileShadow =
    '0 1px 2px color-mix(in srgb, var(--accent-2) 12%, transparent), 0 16px 34px -14px color-mix(in srgb, var(--accent-2) 34%, transparent)';

  return (
    <section id="top" className="relative isolate overflow-hidden bg-ink">
      {/* ── Full-bleed hero image (LCP) ── */}
      {slide?.url ? (
        heroPic?.webpSrcSet ? (
          <picture>
            {heroPic.avifSrcSet && (
              <source type="image/avif" srcSet={heroPic.avifSrcSet} sizes="100vw" />
            )}
            <source type="image/webp" srcSet={heroPic.webpSrcSet} sizes="100vw" />
            <img
              src={heroPic.src}
              alt={slide.alt}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width={1600}
              height={900}
              sizes="100vw"
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />
          </picture>
        ) : (
          <img
            {...responsiveImage(slide.url)}
            alt={slide.alt}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width={1600}
            height={900}
            sizes="100vw"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
        )
      ) : (
        <div
          role="img"
          aria-label={`${brand.name} placeholder image`}
          className="absolute inset-0 -z-20 bg-ink bg-[repeating-linear-gradient(45deg,transparent,transparent_12px,rgba(255,255,255,0.03)_12px,rgba(255,255,255,0.03)_24px)]"
        />
      )}
      {/* Legibility scrim — a FLAT dark plate (decision 30b forbids feathered gradient scrims,
          the most-cited AI tell). Paired with the headline's text-shadow for legibility. */}
      <div className="absolute inset-0 -z-10 bg-[rgba(9,14,22,0.56)]" />

      <div className="mx-auto flex min-h-[560px] max-w-6xl items-center px-5 pb-16 pt-24 sm:px-6 lg:min-h-[620px] lg:pb-20 lg:pt-28">
        <div className="max-w-[640px] text-onInk">
          {review && (
            /* Not LCP — staggers in. */
            <p className="hero-rise mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] font-bold" style={{ animationDelay: '0.05s' }}>
              <span className="flex text-[color:var(--accent-200)]" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={17} weight="fill" className={i < Math.round(review.rating) ? '' : 'opacity-25'} />
                ))}
              </span>
              <span>{review.rating}</span>
              <span className="font-semibold text-onInkSoft">from {review.count}+ customer reviews</span>
            </p>
          )}

          {/* THE LCP HEADLINE. No entrance animation. Condensed display via font-heading. */}
          <h1 className="font-heading text-[40px] font-bold leading-[1.02] tracking-[-0.005em] text-onInk [text-shadow:0_3px_18px_rgba(0,0,0,0.45)] sm:text-[52px] lg:text-[62px]">
            {editing
              ? <E p="hero.headline" fit>{hero.headline}</E>
              : <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />}
          </h1>

          {/* THE LCP SUB. Nothing may gate its paint. */}
          <p className="mt-5 max-w-[48ch] text-[18px] leading-relaxed text-onInkSoft sm:text-[19px]">
            <E p="hero.sub">{hero.sub}</E>
          </p>

          <div className="hero-rise mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch" style={{ animationDelay: '0.18s' }}>
            <a
              href={brand.phoneHref}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg bg-accent px-6 py-3.5 text-accentFg transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-105"
            >
              <span className="flex items-center gap-2.5 whitespace-nowrap text-[23px] font-extrabold tracking-[-0.02em]">
                <PhoneCall size={22} weight="fill" aria-hidden="true" />
                <E p="brand.phone">{brand.phone}</E>
              </span>
              {hero.secondaryCta && (
                <span className="text-[13.5px] font-semibold">
                  <E p="hero.secondaryCta">{hero.secondaryCta}</E>
                </span>
              )}
            </a>

            <a
              href="#cta"
              className="group flex items-center justify-center gap-2 rounded-lg border-2 border-white/40 px-6 py-3.5 text-[17px] font-bold text-onInk transition-colors hover:border-transparent hover:bg-accent hover:text-accentFg"
            >
              <E p="hero.cta">{hero.cta}</E>
              <ArrowRight size={17} weight="bold" aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>

          {hero.frictionReducers.length > 0 && (
            <ul className="hero-rise mt-7 grid max-w-[560px] grid-cols-2 gap-x-4 gap-y-3 border-t border-white/18 pt-5" style={{ animationDelay: '0.26s' }}>
              {hero.frictionReducers.map((f, i) => (
                <li key={f} className="flex items-start gap-2 text-[15px] font-semibold leading-snug text-onInk">
                  <CheckCircle size={19} weight="fill" className="mt-px shrink-0 text-[color:var(--accent-200)]" aria-hidden="true" />
                  <E p={`hero.frictionReducers.${i}`}>{f}</E>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Stat tiles (hero.heroBullets, lifted out of the old flat accent band) ── */}
      {hero.heroBullets.length > 0 && (
        <div className="bg-bgSoft">
          <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 lg:py-12">
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {hero.heroBullets.map((b, i) => (
                <li
                  key={b.label}
                  className={`relative overflow-hidden rounded-2xl border border-rule p-6 ${s.card}`}
                  style={{ boxShadow: tileShadow }}
                >
                  {/* Accent-bar cap — reads the two-tone --accent-bar gradient. */}
                  <span className="absolute left-6 top-0 h-1 w-11 rounded-b" style={{ background: 'var(--accent-bar)' }} aria-hidden="true" />
                  <p className={`font-heading text-[40px] font-bold leading-none tracking-[-0.01em] lg:text-[46px] ${s.heading}`}>
                    <E p={`hero.heroBullets.${i}.value`} fit>{b.value}</E>
                  </p>
                  <p className={`mt-2 text-[13.5px] font-semibold leading-tight ${s.body}`}>
                    <E p={`hero.heroBullets.${i}.label`}>{b.label}</E>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
