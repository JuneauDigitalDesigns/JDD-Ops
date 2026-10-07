'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ServicesSpotlight — the stacked-panels archetype (see DESIGN-LANGUAGE.md and the
// Phase 5 specimen). Full-width horizontal panels, one column. Hierarchy comes from
// PANEL HEIGHT VARIATION plus display-3 vs card-title, not decoration: the first
// service is the tall lead panel (with its image on desktop), the rest are compact.
// No cursor glow (decision 28) — that effect was this component's old identity and
// is cut.
// ─────────────────────────────────────────────────────────────────────────────
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
  const items = services.items;
  if (!items.length) return null;

  const [lead, ...rest] = items;

  return (
    <section id="services" className={`py-24 ${s.section}`}>
      <div className="mx-auto max-w-5xl px-6">
        <motion.h2
          className={`max-w-xl font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}
          initial={still ? false : { opacity: 0, y: 14 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <E p="services.title">{services.title}</E>
        </motion.h2>

        <div className="mt-10">
          {/* Lead panel: tall, display-3 title, image on desktop. */}
          <motion.div
            className={`grid gap-6 border-t ${s.rule} py-10 lg:grid-cols-[minmax(0,1fr)_34%] lg:items-center`}
            initial={still ? false : { opacity: 0, y: 16 }}
            whileInView={still ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div>
              <span className={`text-sm font-semibold ${s.body}`}><E p="services.items.0.tag">{lead.tag}</E></span>
              <h3 className={`mt-1 font-heading text-2xl font-semibold tracking-[-0.01em] ${s.heading} md:text-3xl`}><E p="services.items.0.t">{lead.t}</E></h3>
              <p className={`mt-3 max-w-xl ${s.body}`}><E p="services.items.0.d">{lead.d}</E></p>
            </div>
            <div className="overflow-hidden rounded-xl">
              {lead.image?.url ? (
                <img
                  {...responsiveImage(lead.image.url)}
                  alt={lead.image.alt}
                  loading="lazy"
                  decoding="async"
                  width={800}
                  height={533}
                  sizes="(min-width: 1024px) 34vw, 100vw"
                  className="aspect-[3/2] h-full w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[3/2] w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                  <span className="font-heading text-4xl font-black leading-none text-inkSoft/30">01</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Compact panels: the height difference is the hierarchy. */}
          {rest.map((item, idx) => {
            const i = idx + 1;
            const last = i === items.length - 1;
            return (
              <motion.div
                key={item.n ?? i}
                className={`border-t ${s.rule} py-6 ${last ? `border-b ${s.rule}` : ''}`}
                initial={still ? false : { opacity: 0, y: 12 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, ease: EASE, delay: still ? 0 : idx * 0.05 }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h3 className={`font-heading text-xl font-semibold tracking-[-0.01em] ${s.heading}`}><E p={`services.items.${i}.t`}>{item.t}</E></h3>
                  <span className={`text-sm ${s.body}`}><E p={`services.items.${i}.tag`}>{item.tag}</E></span>
                </div>
                <p className={`mt-1 max-w-2xl text-sm ${s.body}`}><E p={`services.items.${i}.d`}>{item.d}</E></p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
