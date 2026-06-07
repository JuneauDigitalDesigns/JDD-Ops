'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'work-masonry',
  category: 'work',
  label: 'Work / Masonry',
  consumes: ['work.eyebrow', 'work.title', 'work.sub', 'work.projects', 'work.hidden'],
  sharedDeps: ['framer-motion'],
} as const;

const HEIGHTS = ['aspect-[4/3]', 'aspect-[3/4]', 'aspect-[1/1]'];

export default function WorkMasonry() {
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
          <h2 className="mt-2 font-heading text-3xl font-bold text-ink md:text-4xl">{work.title}</h2>
          <p className="mt-3 text-inkSoft">{work.sub}</p>
        </motion.div>

        <div className="mt-10 columns-1 gap-6 sm:columns-2 lg:columns-3">
          {work.projects.map((p, i) => (
            <motion.article
              key={i}
              className="group mb-6 break-inside-avoid overflow-hidden rounded-xl bg-bgSoft"
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.07 }}
            >
              <div className={`relative overflow-hidden ${HEIGHTS[i % HEIGHTS.length]}`}>
                {p.image?.url ? (
                  <img src={p.image.url} alt={p.image.alt} loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                    <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">{p.caption}</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <span className="text-xs font-medium text-accent">{p.scope}</span>
                <h3 className="mt-1 font-heading text-sm font-semibold text-ink">{p.t}</h3>
                <p className="mt-1 text-xs text-inkSoft">{p.loc}{p.yr ? ` · ${p.yr}` : ''}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
