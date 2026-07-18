'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FinalCtaGradient — recomposed as a Giant Statement (see DESIGN-LANGUAGE.md).
// One oversized headline over the branded gradient + accent ring, with an
// offset-shadow CTA. Growth/enterprise: phone (secondary call link).
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'finalcta-gradient',
  category: 'finalCta',
  label: 'Final CTA / Gradient',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.secondary', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['contrast', 'editorial'],
  leadMode: 'phone',
} as const;

export default function FinalCtaGradient({
  content = CONTENT,
  skin = 'contrast',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { finalCta, brand } = content;
  const dark = skin === 'contrast';

  return (
    <section
      id="cta"
      className={`relative isolate overflow-hidden py-32 text-center ${s.section}`}
      style={{
        background: dark
          ? 'linear-gradient(135deg, var(--ink-panel) 0%, var(--ink-panel-2) 50%, var(--ink-panel) 100%)'
          : 'linear-gradient(135deg, var(--bg-soft) 0%, color-mix(in srgb, var(--accent) 8%, var(--bg)) 50%, var(--bg-soft) 100%)',
      }}
    >
      {/* Decorative accent ring */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/15 bg-accent/[0.06]" />

      <div className="relative mx-auto max-w-4xl px-6">
        <motion.div
          initial={still ? false : { opacity: 0, y: 24 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <p className={`flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
          </p>
          <h2 className={`mx-auto mt-6 max-w-3xl font-heading text-5xl font-bold leading-[0.9] tracking-[-0.035em] ${s.heading} md:text-7xl`}><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className={`mx-auto mt-6 max-w-lg text-lg leading-relaxed ${s.body}`}><E p="finalCta.sub">{finalCta.sub}</E></p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
            <a
              href="#contact"
              className="group inline-flex items-center gap-2 rounded-sm bg-accent px-8 py-4 font-semibold text-accentFg transition-transform hover:-translate-y-0.5"
              style={{ boxShadow: dark ? '4px 4px 0px 0px rgba(255,255,255,0.14)' : '4px 4px 0px 0px rgba(0,0,0,0.85)' }}
            >
              <E p="finalCta.cta">{finalCta.cta}</E>
              <ArrowRight size={17} weight="bold" className="transition-transform group-hover:translate-x-1" />
            </a>
            {finalCta.secondary && (
              <a
                href={brand.phoneHref}
                className={`inline-flex items-center gap-2 font-medium ${s.heading} hover:text-accent`}
              >
                <PhoneCall size={17} weight="bold" />
                <E p="finalCta.secondary">{finalCta.secondary}</E>
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
