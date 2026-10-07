'use client';
// ─────────────────────────────────────────────────────────────────────────────
// WorkMasonry — the horizontal-pin archetype (see DESIGN-LANGUAGE.md and the Phase 5
// specimen). The ONLY signature:true component in wave 1. The section pins while the
// job cards scroll horizontally, driven by a framer-motion useScroll transform (no
// GSAP). Under reduced motion / a still skin it degrades to a plain overflow-x-auto
// scroll-snap rail with no scroll transform and no sticky pin.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'work-masonry',
  category: 'work',
  label: 'Work / Masonry',
  consumes: ['work.eyebrow', 'work.title', 'work.sub', 'work.projects', 'work.hidden'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['default', 'soft'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'horizontal-pin',
  /** The one signature moment in wave 1: a scroll-linked horizontal pin. Budgeted per PAGE. */
  signature: true,
} as const;

function Card({ i, p, s }: { i: number; p: SiteContent['work']['projects'][number]; s: ReturnType<typeof skinClasses> }) {
  return (
    <div className="w-[78vw] shrink-0 snap-start sm:w-[46vw] lg:w-[32vw]">
      <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: '3/2' }}>
        {p.image?.url ? (
          <img src={p.image.url} alt={p.image.alt} loading="lazy" width={1200} height={800} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
            <span className="font-heading text-5xl font-black leading-none text-inkSoft/30">{String(i + 1).padStart(2, '0')}</span>
          </div>
        )}
      </div>
      <p className={`mt-3 font-heading text-sm font-semibold ${s.heading}`}><E p={`work.projects.${i}.t`}>{p.t}</E></p>
      <p className={`mt-0.5 text-xs ${s.body}`}>{[p.loc, p.yr].filter(Boolean).join(' · ')}</p>
    </div>
  );
}

export default function WorkMasonry({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = reduce; // skin has no still role; honour reduced-motion only
  const s = skinClasses(skin);
  const { work } = content;

  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      setDistance(Math.max(0, track.scrollWidth - track.clientWidth));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const { scrollYProgress } = useScroll({ target: pinRef, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);

  if (work.hidden) return null;
  if (!work.projects.length) return null;
  const projects = work.projects;

  const header = (
    <div className="mx-auto max-w-6xl px-6">
      <h2 className={`font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="work.title">{work.title}</E></h2>
      <p className={`mt-3 max-w-xl ${s.body}`}><E p="work.sub">{work.sub}</E></p>
    </div>
  );

  // Reduced motion / still: a plain scroll-snap rail, no pin, no transform.
  if (still) {
    return (
      <section id="work" className={`py-24 ${s.section}`}>
        {header}
        <div className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-2">
          {projects.map((p, i) => <Card key={i} i={i} p={p} s={s} />)}
        </div>
      </section>
    );
  }

  return (
    <section id="work" className={s.section}>
      <div className="pt-24">{header}</div>
      {/* Tall outer drives the pin; inner sticky viewport holds the translating track. */}
      <div ref={pinRef} style={{ height: `${Math.max(120, projects.length * 72)}vh` }} className="relative">
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          <motion.div ref={trackRef} style={{ x }} className="flex gap-5 px-6 will-change-transform">
            {projects.map((p, i) => <Card key={i} i={i} p={p} s={s} />)}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
