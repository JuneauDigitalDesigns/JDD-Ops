'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, CheckCircle } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E, useEditing } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'hero-centered',
  category: 'hero',
  label: 'Hero / Centered statement',
  consumes: [
    'hero.eyebrow', 'hero.headline', 'hero.headlineEmphasis', 'hero.sub',
    'hero.badge', 'hero.cta', 'hero.secondaryCta', 'hero.frictionReducers', 'hero.heroBullets',
    'brand.phoneHref',
  ],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast'],
} as const;

function Headline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const idx = text.indexOf(emphasis);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent">{emphasis}</span>
      {text.slice(idx + emphasis.length)}
    </>
  );
}

export default function HeroCentered({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const editing = useEditing();
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { hero, brand } = content;

  return (
    <section className={`px-6 py-24 text-center ${s.section}`}>
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={still ? false : { opacity: 0, y: 24 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {hero.badge && (
            <div className={`mb-6 inline-flex items-center gap-1.5 rounded-full border ${s.rule} ${s.card} px-4 py-1.5 text-xs font-medium ${s.body}`}>
              <E p="hero.badge">{hero.badge}</E>
            </div>
          )}

          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${s.eyebrow}`}>
            <E p="hero.eyebrow">{hero.eyebrow}</E>
          </p>

          <h1 className={`mt-5 font-heading text-5xl font-bold leading-[0.98] tracking-[-0.02em] ${s.heading} md:text-6xl lg:text-7xl`}>
            {editing
              ? <E p="hero.headline" fit>{hero.headline}</E>
              : <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />}
          </h1>

          <p className={`mx-auto mt-6 max-w-xl text-lg leading-relaxed ${s.body}`}>
            <E p="hero.sub">{hero.sub}</E>
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-semibold text-accentFg shadow-[0_10px_30px_-10px_var(--accent-glow)] transition-transform hover:-translate-y-0.5"
            >
              <E p="hero.cta">{hero.cta}</E>
            </a>
            {hero.secondaryCta && (
              <a
                href={brand.phoneHref}
                className={`inline-flex items-center gap-2 rounded-full border ${s.rule} px-7 py-3.5 font-medium ${s.heading} transition-colors hover:text-accent`}
              >
                <PhoneCall size={18} weight="bold" />
                <E p="hero.secondaryCta">{hero.secondaryCta}</E>
              </a>
            )}
          </div>

          {hero.frictionReducers.length > 0 && (
            <div className="mt-7 flex flex-wrap justify-center gap-5">
              {hero.frictionReducers.map((f, i) => (
                <span key={f} className={`flex items-center gap-1.5 text-sm ${s.body}`}>
                  <CheckCircle size={14} weight="fill" className="text-accent" />
                  <E p={`hero.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </motion.div>

        {hero.heroBullets.length > 0 && (
          <motion.div
            className={`mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border ${s.rule} sm:grid-cols-4`}
            initial={still ? false : { opacity: 0, y: 16 }}
            whileInView={still ? undefined : { opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
          >
            {hero.heroBullets.map((b, i) => (
              <div key={b.label} className={`px-5 py-6 ${i % 2 === 0 ? s.section : s.card}`}>
                <p className="font-heading text-3xl font-bold text-accent"><E p={`hero.heroBullets.${i}.value`} fit>{b.value}</E></p>
                <p className={`mt-1 text-xs ${s.body}`}><E p={`hero.heroBullets.${i}.label`}>{b.label}</E></p>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
