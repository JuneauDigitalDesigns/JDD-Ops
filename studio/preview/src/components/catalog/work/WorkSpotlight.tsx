'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'work-spotlight',
  category: 'work',
  label: 'Work / Spotlight',
  consumes: ['work.eyebrow', 'work.title', 'work.projects', 'work.hidden'],
  sharedDeps: ['framer-motion'],
} as const;

export default function WorkSpotlight() {
  const reduce = useReducedMotion() ?? false;
  const { work } = CONTENT;
  if (work.hidden) return null;
  if (!work.projects.length) return null;

  const [featured, ...rest] = work.projects;

  return (
    <section id="work" className="bg-bgSoft py-20">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{work.eyebrow}</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-ink md:text-4xl">{work.title}</h2>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Featured */}
          <motion.article
            className="group overflow-hidden rounded-2xl bg-bg"
            initial={reduce ? false : { opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
              {featured.image?.url ? (
                <img src={featured.image.url} alt={featured.image.alt} loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-103" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                  <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">{featured.caption}</span>
                </div>
              )}
              <span className="absolute left-4 top-4 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-bg">{featured.scope}</span>
            </div>
            <div className="p-7">
              <h3 className="font-heading text-xl font-bold text-ink">{featured.t}</h3>
              <p className="mt-2 leading-relaxed text-inkSoft">{featured.caption}</p>
              <div className="mt-4 flex gap-6 text-sm">
                <div><span className="text-xs font-semibold uppercase tracking-wider text-accent">Location</span><p className="mt-0.5 text-ink">{featured.loc}</p></div>
                <div><span className="text-xs font-semibold uppercase tracking-wider text-accent">Size</span><p className="mt-0.5 text-ink">{featured.size}</p></div>
                {featured.yr && <div><span className="text-xs font-semibold uppercase tracking-wider text-accent">Year</span><p className="mt-0.5 text-ink">{featured.yr}</p></div>}
              </div>
            </div>
          </motion.article>

          {/* Rest list */}
          {rest.length > 0 && (
            <div className="flex flex-col gap-4">
              {rest.map((p, i) => (
                <motion.article
                  key={i}
                  className="group flex gap-4 overflow-hidden rounded-xl bg-bg p-4"
                  initial={reduce ? false : { opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
                >
                  <div className="relative w-24 shrink-0 overflow-hidden rounded-lg" style={{ aspectRatio: '4/3' }}>
                    {p.image?.url ? (
                      <img src={p.image.url} alt={p.image.alt} loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full bg-bgSoft" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-accent">{p.scope}</span>
                    <h3 className="mt-0.5 font-heading text-sm font-semibold leading-snug text-ink">{p.t}</h3>
                    <p className="mt-1 text-xs text-inkSoft">{p.loc}{p.yr ? ` · ${p.yr}` : ''}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
