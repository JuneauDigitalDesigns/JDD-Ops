'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'work-spotlight',
  category: 'work',
  label: 'Work / Spotlight',
  consumes: ['work.eyebrow', 'work.title', 'work.projects', 'work.hidden'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast', 'quiet'],
} as const;

function EmptyImage({ label, big }: { label: string; big?: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-accent-grad">
      <span className={`font-heading font-black leading-none text-white/25 ${big ? 'text-7xl' : 'text-4xl'}`}>{label}</span>
    </div>
  );
}

export default function WorkSpotlight({
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

  const [featured, ...rest] = work.projects;

  return (
    <section id="work" className={`py-24 ${s.section}`}>
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={still ? false : { opacity: 0, y: 14 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-11"
        >
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${s.eyebrow}`}><E p="work.eyebrow">{work.eyebrow}</E></p>
          <h2 className={`mt-3 font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="work.title">{work.title}</E></h2>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Featured */}
          <motion.article
            className={`group overflow-hidden rounded-3xl border ${s.cardRule} ${s.card}`}
            initial={still ? false : { opacity: 0, x: -16 }}
            whileInView={still ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
              {featured.image?.url ? (
                <img src={featured.image.url} alt={featured.image.alt} loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <EmptyImage label="01" big />
              )}
            </div>
            <div className="p-7">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent"><E p="work.projects.0.scope">{featured.scope}</E></span>
              <h3 className={`mt-1 font-heading text-xl font-bold ${s.heading}`}><E p="work.projects.0.t">{featured.t}</E></h3>
              <p className={`mt-2 leading-relaxed ${s.body}`}><E p="work.projects.0.caption">{featured.caption}</E></p>
              <div className="mt-4 flex gap-6 text-sm">
                <div><span className="text-xs font-semibold uppercase tracking-wider text-accent">Location</span><p className={`mt-0.5 ${s.heading}`}><E p="work.projects.0.loc">{featured.loc}</E></p></div>
                <div><span className="text-xs font-semibold uppercase tracking-wider text-accent">Size</span><p className={`mt-0.5 ${s.heading}`}><E p="work.projects.0.size">{featured.size}</E></p></div>
                {featured.yr && <div><span className="text-xs font-semibold uppercase tracking-wider text-accent">Year</span><p className={`mt-0.5 ${s.heading}`}><E p="work.projects.0.yr">{featured.yr}</E></p></div>}
              </div>
            </div>
          </motion.article>

          {/* Rest list */}
          {rest.length > 0 && (
            <div className="flex flex-col gap-4">
              {rest.map((p, i) => (
                <motion.article
                  key={i}
                  className={`group flex gap-4 overflow-hidden rounded-2xl border ${s.cardRule} ${s.card} p-4`}
                  initial={still ? false : { opacity: 0, x: 16 }}
                  whileInView={still ? undefined : { opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.45, ease: EASE, delay: still ? 0 : i * 0.06 }}
                >
                  <div className="relative w-24 shrink-0 overflow-hidden rounded-lg" style={{ aspectRatio: '4/3' }}>
                    {p.image?.url ? (
                      <img src={p.image.url} alt={p.image.alt} loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <EmptyImage label={String(i + 2).padStart(2, '0')} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-accent"><E p={`work.projects.${i + 1}.scope`}>{p.scope}</E></span>
                    <h3 className={`mt-0.5 font-heading text-sm font-bold leading-snug ${s.heading}`}><E p={`work.projects.${i + 1}.t`}>{p.t}</E></h3>
                    <p className={`mt-1 text-xs ${s.body}`}>
                      <E p={`work.projects.${i + 1}.loc`}>{p.loc}</E>{p.yr ? <> · <E p={`work.projects.${i + 1}.yr`}>{p.yr}</E></> : ''}
                    </p>
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
