'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'work-grid',
  category: 'work',
  label: 'Work / Grid',
  consumes: ['work.eyebrow', 'work.title', 'work.sub', 'work.projects', 'work.hidden'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast'],
} as const;

export default function WorkGrid({
  content = CONTENT,
  skin = 'editorial',
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
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${s.eyebrow}`}><E p="work.eyebrow">{work.eyebrow}</E></p>
          <h2 className={`mt-3 font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="work.title">{work.title}</E></h2>
          <p className={`mt-3 ${s.body}`}><E p="work.sub">{work.sub}</E></p>
        </motion.div>

        <div className="mt-11 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {work.projects.map((p, i) => (
            <motion.article
              key={i}
              className={`group overflow-hidden rounded-2xl border ${s.cardRule} ${s.card}`}
              initial={still ? false : { opacity: 0, y: 20 }}
              whileInView={still ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, ease: EASE, delay: still ? 0 : i * 0.06 }}
              style={{ gridRow: i === 0 ? 'span 2' : 'auto' }}
            >
              <div className="relative overflow-hidden" style={{ aspectRatio: i === 0 ? '3/4' : '4/3' }}>
                {p.image?.url ? (
                  <img src={p.image.url} alt={p.image.alt} loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center bg-accent-grad">
                    <span className="font-heading text-5xl font-black leading-none text-white/25">{String(i + 1).padStart(2, '0')}</span>
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
