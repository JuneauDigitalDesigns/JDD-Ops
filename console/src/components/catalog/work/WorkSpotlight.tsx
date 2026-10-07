'use client';
// ─────────────────────────────────────────────────────────────────────────────
// WorkSpotlight — the feature-rail archetype (see DESIGN-LANGUAGE.md and the Phase 5
// specimen). A large feature panel showing one job, beside a rail that selects it.
// The active-item cue is INK, not accent (decision 10). At 390 the side rail cannot
// exist, so the rail becomes a short stacked list above the feature.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, stillFor } from '@/lib/motion';

export const meta = {
  id: 'work-spotlight',
  category: 'work',
  label: 'Work / Spotlight',
  consumes: ['work.eyebrow', 'work.title', 'work.sub', 'work.projects', 'work.hidden'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['default', 'inverted'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'feature-rail',
  signature: false,
} as const;

export default function WorkSpotlight({
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
  const [active, setActive] = useState(0);
  if (work.hidden) return null;
  if (!work.projects.length) return null;

  const projects = work.projects;
  const current = projects[Math.min(active, projects.length - 1)];

  return (
    <section id="work" className={`py-24 ${s.section}`}>
      <div className="mx-auto max-w-6xl px-6">
        <h2 className={`max-w-xl font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="work.title">{work.title}</E></h2>
        <p className={`mt-3 max-w-xl ${s.body}`}><E p="work.sub">{work.sub}</E></p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[62%_minmax(0,1fr)] lg:items-start">
          {/* Feature panel */}
          <div className="order-2 lg:order-1">
            <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: '3/2' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  className="absolute inset-0"
                  initial={still ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={still ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  {current.image?.url ? (
                    <img src={current.image.url} alt={current.image.alt} loading="lazy" width={1200} height={800}
                      className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                      <span className="font-heading text-6xl font-black leading-none text-inkSoft/30">{String(active + 1).padStart(2, '0')}</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-4">
              <span className={`text-xs font-medium uppercase tracking-wider ${s.body}`}>{current.scope}</span>
              <h3 className={`mt-1 font-heading text-xl font-semibold tracking-[-0.01em] ${s.heading}`}>{current.t}</h3>
              <p className={`mt-1 text-sm ${s.body}`}>{[current.loc, current.yr].filter(Boolean).join(' · ')}</p>
              {current.caption && <p className={`mt-2 max-w-prose text-sm ${s.body}`}>{current.caption}</p>}
            </div>
          </div>

          {/* Rail */}
          <div className="order-1 grid gap-2 lg:order-2">
            {projects.map((p, i) => {
              const on = i === active;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-pressed={on}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${on ? `${s.heading} border-2` : `${s.body} ${s.cardRule}`}`}
                  style={on ? { borderColor: 'var(--ink)' } : undefined}
                >
                  <span className="block font-heading text-sm font-semibold"><E p={`work.projects.${i}.t`}>{p.t}</E></span>
                  <span className={`mt-0.5 block text-xs ${on ? s.body : ''}`}>{[p.loc, p.yr].filter(Boolean).join(' · ')}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
