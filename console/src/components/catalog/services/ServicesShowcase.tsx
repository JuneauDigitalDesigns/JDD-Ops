'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ServicesShowcase — recomposed as an Editorial Index (see DESIGN-LANGUAGE.md).
// Type-forward magazine contents page: full-width numbered rows on hairline rules,
// oversized numerals, and imagery that reveals on hover. Distinct from the
// Feature+Rail (Grid) and the mosaic (Bento). Structure over decoration.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'services-showcase',
  category: 'services',
  label: 'Services / Showcase',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast', 'quiet'],
} as const;

export default function ServicesShowcase({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { services } = content;
  if (!services.items.length) return null;

  return (
    <section id="services" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="mb-10 max-w-xl"
          initial={still ? false : { opacity: 0, y: 14 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="services.eyebrow">{services.eyebrow}</E>
          </p>
          <h2 className={`mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] ${s.heading} md:text-5xl`}><E p="services.title">{services.title}</E></h2>
          <p className={`mt-4 ${s.body}`}><E p="services.sub">{services.sub}</E></p>
        </motion.div>

        {/* Editorial index — one full-width row per service */}
        <ul className={`border-t ${s.rule}`}>
          {services.items.map((item, i) => {
            const nn = String(item.n ?? i + 1).padStart(2, '0');
            return (
              <motion.li
                key={item.n ?? i}
                className={`border-b ${s.rule}`}
                initial={still ? false : { opacity: 0, y: 16 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, ease: EASE, delay: still ? 0 : i * 0.05 }}
              >
                <a
                  href="#contact"
                  className="group grid grid-cols-[auto_1fr] items-center gap-5 py-7 sm:gap-8 lg:grid-cols-[auto_1fr_auto]"
                >
                  <span className={`font-heading text-4xl font-black leading-none tabular-nums transition-colors sm:text-5xl ${s.heading} opacity-25 group-hover:text-accent group-hover:opacity-100`}>
                    {nn}
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-accent"><E p={`services.items.${i}.tag`}>{item.tag}</E></span>
                    <h3 className={`mt-1 font-heading text-2xl font-bold tracking-[-0.02em] transition-colors sm:text-3xl ${s.heading} group-hover:text-accent`}><E p={`services.items.${i}.t`}>{item.t}</E></h3>
                    <p className={`mt-1.5 max-w-xl text-sm leading-relaxed ${s.body}`}><E p={`services.items.${i}.d`}>{item.d}</E></p>
                  </div>
                  {/* Image reveals on hover — the index's standout moment (desktop only) */}
                  <div className="hidden overflow-hidden rounded-xl lg:block lg:w-48" style={{ aspectRatio: '3/2' }}>
                    {item.image?.url ? (
                      <img src={item.image.url} alt={item.image.alt} loading="lazy"
                        className="h-full w-full scale-105 object-cover opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-accent-grad opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                        <span className="font-heading text-3xl font-black leading-none text-white/30">{nn}</span>
                      </div>
                    )}
                  </div>
                </a>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
