'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ServicesShowcase — the editorial-index archetype (see DESIGN-LANGUAGE.md and the
// Phase 5 specimen). Full-width numbered rows on hairline rules; on desktop a hover
// reveals the service image in a right-hand column (CSS only, no JS). Numerals are
// NEUTRAL, not accent (decision 10). At 390 there is no room for the reveal, so the
// row is title + description only.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { responsiveImage } from '@/lib/img';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'services-showcase',
  category: 'services',
  label: 'Services / Showcase',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['default', 'soft'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'editorial-index',
  /** True if this component owns a SIGNATURE motion moment. Micro-reveals do not count. */
  signature: false,
} as const;

export default function ServicesShowcase({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { services } = content;
  const items = services.items;
  if (!items.length) return null;

  return (
    <section id="services" className={`py-24 ${s.section}`}>
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="max-w-xl"
          initial={still ? false : { opacity: 0, y: 14 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <h2 className={`font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="services.title">{services.title}</E></h2>
          <p className={`mt-3 ${s.body}`}><E p="services.sub">{services.sub}</E></p>
        </motion.div>

        <div className="mt-10">
          {items.map((item, i) => {
            const nn = String(item.n ?? i + 1).padStart(2, '0');
            const last = i === items.length - 1;
            return (
              <motion.div
                key={item.n ?? i}
                className={`group grid grid-cols-[2.5rem_1fr] items-baseline gap-x-4 border-t ${s.rule} py-6 lg:grid-cols-[3rem_minmax(0,1fr)_34%] lg:gap-x-8 ${last ? `border-b ${s.rule}` : ''}`}
                initial={still ? false : { opacity: 0, y: 14 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: EASE, delay: still ? 0 : i * 0.04 }}
              >
                <span aria-hidden className={`font-heading text-base font-bold tabular-nums ${s.body}`}>{nn}</span>
                <div>
                  <h3 className={`font-heading text-xl font-semibold tracking-[-0.01em] ${s.heading}`}><E p={`services.items.${i}.t`}>{item.t}</E></h3>
                  <p className={`mt-1 text-sm ${s.body}`}><E p={`services.items.${i}.d`}>{item.d}</E></p>
                </div>
                {/* Desktop-only hover reveal: an image enhancement, never content. The row is
                    complete without it at 390 (SPEC §8). */}
                <div className="hidden self-center overflow-hidden rounded-xl lg:col-start-3 lg:block lg:max-h-0 lg:opacity-0 lg:transition-all lg:duration-500 lg:ease-out lg:group-hover:max-h-44 lg:group-hover:opacity-100">
                  {item.image?.url ? (
                    <img
                      {...responsiveImage(item.image.url)}
                      alt={item.image.alt}
                      loading="lazy"
                      decoding="async"
                      width={800}
                      height={500}
                      sizes="(min-width: 1024px) 34vw, 0px"
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                      <span className="font-heading text-4xl font-black leading-none text-inkSoft/30">{nn}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
