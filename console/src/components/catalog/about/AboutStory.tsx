'use client';
// ─────────────────────────────────────────────────────────────────────────────
// AboutStory — recomposed as an editorial 2-column split (see DESIGN-LANGUAGE.md).
// Sticky narrative on the left, pillars as a hairline-divided list on the right.
// Narrative-led; distinct from the image feature / stat stack / pillar index.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Clock, Tag, Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'about-story',
  category: 'about',
  label: 'About / Story',
  consumes: ['about.eyebrow', 'about.title', 'about.body', 'about.pillars'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'quiet'],
} as const;

const ICON_MAP: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  shield: ShieldCheck,
  clock: Clock,
  tag: Tag,
  star: Star,
};

export default function AboutStory({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { about } = content;

  return (
    <section id="about" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        {/* Narrative — sticky on desktop */}
        <motion.div
          className="lg:sticky lg:top-24 lg:self-start"
          initial={still ? false : { opacity: 0, y: 16 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="about.eyebrow">{about.eyebrow}</E>
          </p>
          <h2 className={`mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] ${s.heading} md:text-5xl`}><E p="about.title">{about.title}</E></h2>
          <p className={`mt-6 text-lg leading-relaxed ${s.body}`}><E p="about.body">{about.body}</E></p>
        </motion.div>

        {/* Pillars — hairline-divided list */}
        {about.pillars.length > 0 && (
          <div className={`border-t divide-y divide-rule ${s.rule}`}>
            {about.pillars.map((p, i) => {
              const Icon = ICON_MAP[p.k];
              return (
                <motion.div
                  key={p.k}
                  className="flex gap-5 py-7"
                  initial={still ? false : { opacity: 0, y: 12 }}
                  whileInView={still ? undefined : { opacity: 1, y: 0 }}
                  viewport={viewportOnce}
                  transition={{ duration: 0.45, ease: EASE, delay: still ? 0 : i * 0.06 }}
                >
                  <span className={`font-heading text-2xl font-black leading-none tabular-nums ${s.heading} opacity-25`}>{String(i + 1).padStart(2, '0')}</span>
                  <div className="flex-1">
                    <h3 className={`flex items-center gap-2 font-heading text-lg font-bold ${s.heading}`}>
                      {Icon && <Icon size={19} className="text-accent" />}
                      <E p={`about.pillars.${i}.t`}>{p.t}</E>
                    </h3>
                    <p className={`mt-2 leading-relaxed ${s.body}`}><E p={`about.pillars.${i}.d`}>{p.d}</E></p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
