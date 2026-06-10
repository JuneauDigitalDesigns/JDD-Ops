'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'work-grid',
  category: 'work',
  label: 'Work / Grid',
  consumes: ['work.eyebrow', 'work.title', 'work.sub', 'work.projects', 'work.hidden'],
  sharedDeps: ['framer-motion'],
} as const;

export default function WorkGrid() {
  const reduce = useReducedMotion() ?? false;
  const { work } = CONTENT;
  if (work.hidden) return null;
  if (!work.projects.length) return null;

  return (
    <section id="work" className="bg-bg py-20">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="max-w-xl"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{work.eyebrow}</p>
          <h2 className="mt-2 font-heading text-3xl text-ink md:text-4xl">{work.title}</h2>
          <p className="mt-3 text-inkSoft">{work.sub}</p>
        </motion.div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {work.projects.map((p, i) => (
            <motion.article
              key={i}
              className="group overflow-hidden rounded-xl border border-rule bg-bg"
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
              style={{ gridRow: i === 0 ? 'span 2' : 'auto' }}
            >
              <div className="relative overflow-hidden" style={{ aspectRatio: i === 0 ? '3/4' : '4/3' }}>
                {p.image?.url ? (
                  <img src={p.image.url} alt={p.image.alt} loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                    <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">{p.caption}</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <span className="text-xs font-medium uppercase tracking-wider text-accent">{p.scope}</span>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <h3 className="font-heading text-sm font-semibold text-ink">{p.t}</h3>
                  {p.yr && <span className="shrink-0 text-xs text-inkSoft">{p.yr}</span>}
                </div>
                <p className="mt-1 text-xs text-inkSoft">{p.loc}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
