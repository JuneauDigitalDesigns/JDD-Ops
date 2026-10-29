'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ServicesSpotlight — numbered hover-swap list (2026-10 visual upgrade, "Home — Quiet").
//
// Was stacked full-width panels. The upgrade adopts the reference pattern (Air Service of
// Florida): a crossfading image panel beside a numbered 01/02 title list; hovering/focusing a
// row swaps the panel image and the caption detail, with an accent left-border marking the
// active row. Distinctive and interactive while staying "quiet" — one image, generous type.
//
// NOT a signature moment (decision 26): the swap is pointer-driven, not scroll-linked, so it
// does not spend the per-page motion budget. A subtle on-entry fade remains (below the fold).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { responsiveImage } from '@/lib/img';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'services-spotlight',
  category: 'services',
  label: 'Services / Spotlight',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['soft', 'default', 'inverted'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'stacked-panels',
  signature: false,
} as const;

export default function ServicesSpotlight({
  content = CONTENT,
  skin = 'soft',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { services } = content;
  const items = services.items.filter((it) => it.t?.trim());
  const [active, setActive] = useState(0);
  if (!items.length) return null;

  const cur = items[Math.min(active, items.length - 1)];
  const panelShadow =
    '0 4px 10px color-mix(in srgb, var(--accent-2) 10%, transparent), 0 26px 50px -18px color-mix(in srgb, var(--accent-2) 40%, transparent)';

  return (
    <section id="services" className={`py-20 lg:py-24 ${s.section}`}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <h2 className={`font-heading text-3xl font-bold tracking-[-0.01em] md:text-4xl ${s.heading}`}><E p="services.title">{services.title}</E></h2>
          <span className="accent-bar mt-5" aria-hidden="true" />
          {services.sub && <p className={`mt-4 text-[17px] leading-relaxed ${s.body}`}><E p="services.sub">{services.sub}</E></p>}
        </div>

        <motion.div
          className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-stretch"
          initial={still ? false : { opacity: 0, y: 16 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {/* Crossfading image panel. */}
          <div className="relative min-h-[320px] overflow-hidden rounded-2xl bg-ink lg:min-h-[440px]" style={{ boxShadow: panelShadow }}>
            {items.map((it, i) =>
              it.image?.url ? (
                <img
                  key={i}
                  {...responsiveImage(it.image.url)}
                  alt={it.image.alt}
                  loading="lazy"
                  decoding="async"
                  width={900}
                  height={600}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${i === active ? 'opacity-100' : 'opacity-0'}`}
                />
              ) : (
                <div
                  key={i}
                  className={`absolute inset-0 flex items-center justify-center bg-ink bg-[repeating-linear-gradient(45deg,transparent,transparent_12px,rgba(255,255,255,0.04)_12px,rgba(255,255,255,0.04)_24px)] transition-opacity duration-500 ${i === active ? 'opacity-100' : 'opacity-0'}`}
                >
                  <span className="font-heading text-5xl font-bold leading-none text-onInk/20">{String(i + 1).padStart(2, '0')}</span>
                </div>
              ),
            )}
            {/* Active detail caption — flat dark plate (no gradient tell). */}
            <div className="absolute inset-x-0 bottom-0 z-[2] bg-[rgba(8,14,22,0.74)] p-5">
              <p className="font-heading text-[13px] font-bold tracking-[0.12em] text-[color:var(--accent-200)]">
                {String(active + 1).padStart(2, '0')} — {cur.t.toUpperCase()}
              </p>
              <p className="mt-1.5 max-w-[46ch] text-[14px] leading-relaxed text-onInkSoft">
                <E p={`services.items.${active}.d`}>{cur.d}</E>
              </p>
            </div>
          </div>

          {/* Numbered hover-swap list. */}
          <div className="flex flex-col justify-center">
            {items.map((it, i) => {
              const on = i === active;
              return (
                <button
                  type="button"
                  key={it.n ?? i}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  className={`border-l-2 py-4 text-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${on ? 'border-accent pl-7' : `pl-5 ${s.rule}`}`}
                >
                  <span className={`block text-[11px] font-bold tracking-[0.14em] ${on ? 'text-accent' : s.body}`}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={`mt-1 block font-heading text-2xl font-semibold leading-tight tracking-[-0.01em] ${on ? s.heading : s.body}`}><E p={`services.items.${i}.t`}>{it.t}</E></span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
