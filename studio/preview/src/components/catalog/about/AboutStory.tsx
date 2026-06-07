'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Clock, Tag, Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'about-story',
  category: 'about',
  label: 'About / Story',
  consumes: ['about.eyebrow', 'about.title', 'about.body', 'about.pillars'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

const ICON_MAP: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  shield: ShieldCheck,
  clock:  Clock,
  tag:    Tag,
  star:   Star,
};

export default function AboutStory() {
  const reduce = useReducedMotion() ?? false;
  const { about } = CONTENT;

  return (
    <section id="about" className="bg-bg py-24">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{about.eyebrow}</p>
          <h2 className="mt-4 font-heading text-4xl font-bold text-ink md:text-5xl">{about.title}</h2>
          <p className="mt-6 text-lg leading-relaxed text-inkSoft">{about.body}</p>
        </motion.div>

        {about.pillars.length > 0 && (
          <div className="mt-14 space-y-0 divide-y divide-rule">
            {about.pillars.map((p, i) => {
              const Icon = ICON_MAP[p.k];
              const num = String(i + 1).padStart(2, '0');
              return (
                <motion.div
                  key={p.k}
                  className="flex gap-6 py-8"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
                >
                  <div className="flex-shrink-0 pt-0.5">
                    <span className="font-heading text-sm font-semibold text-accent">{num}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {Icon && <Icon size={18} className="text-accent" />}
                      <h3 className="font-heading text-lg font-semibold text-ink">{p.t}</h3>
                    </div>
                    <p className="mt-2 leading-relaxed text-inkSoft">{p.d}</p>
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
