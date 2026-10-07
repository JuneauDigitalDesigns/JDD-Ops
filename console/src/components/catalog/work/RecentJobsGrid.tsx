'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'recent-jobs-grid',
  category: 'work',
  label: 'Recent Jobs / Grid',
  consumes: ['work.eyebrow', 'work.title', 'work.sub', 'work.projects', 'work.hidden'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['default', 'inverted'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category.
   *  Recomposed in Phase 7: the first cell spans two rows and two columns. */
  archetype: 'hero-first-grid',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
} as const;

export default function RecentJobsGrid({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { work } = content;
  if (work.hidden) return null;
  if (!work.projects.length) return null;

  return (
    <section id="work" className={`py-24 ${s.section}`}>
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="max-w-xl"
          initial={still ? false : { opacity: 0, y: 14 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <h2 className={`mt-3 font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="work.title">{work.title}</E></h2>
          <p className={`mt-3 ${s.body}`}><E p="work.sub">{work.sub}</E></p>
        </motion.div>

        {/* hero-first-grid: the first cell spans 2 rows and 2 cols on sm+; the image fills the
            cell via flex so the recompose does not depend on a fixed per-cell aspect. */}
        <div className="mt-11 grid grid-cols-1 gap-6 sm:auto-rows-[200px] sm:grid-cols-2 lg:grid-cols-3">
          {work.projects.map((p, i) => (
            <motion.article
              key={i}
              className={`group flex flex-col overflow-hidden rounded-2xl border ${s.cardRule} ${s.card} ${i === 0 ? 'sm:col-span-2 sm:row-span-2' : ''}`}
              initial={still ? false : { opacity: 0, y: 20 }}
              whileInView={still ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, ease: EASE, delay: still ? 0 : i * 0.06 }}
            >
              <div className="relative min-h-[180px] flex-1 overflow-hidden sm:min-h-0">
                {p.image?.url ? (
                  /* width/height only supply the intrinsic ratio so the box is reserved before the bytes land; CSS (object-cover, flex-fill) sets the rendered size. */
                  <img src={p.image.url} alt={p.image.alt} loading="lazy" width={i === 0 ? 1600 : 1200} height={i === 0 ? 1000 : 900}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  // Decision 30(b): the contract §3 hatch, not a branded gradient slab.
                  <div className="flex h-full w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                    <span className="font-heading text-5xl font-black leading-none text-inkSoft/30">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <span className="text-xs font-medium uppercase tracking-wider text-accent"><E p={`work.projects.${i}.scope`}>{p.scope}</E></span>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <h3 className={`font-heading text-sm font-bold ${s.heading}`}><E p={`work.projects.${i}.t`}>{p.t}</E></h3>
                  {p.yr && <span className={`shrink-0 text-xs ${s.body}`}><E p={`work.projects.${i}.yr`}>{p.yr}</E></span>}
                </div>
                <p className={`mt-1 text-xs ${s.body}`}><E p={`work.projects.${i}.loc`}>{p.loc}</E></p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
