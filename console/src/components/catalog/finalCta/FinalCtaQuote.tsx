'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FinalCtaQuote — recomposed as a Split Checklist Card (see DESIGN-LANGUAGE.md).
// Asymmetric card: headline + sub on the left, the friction checklist + CTA on an
// accent panel on the right. "Get a quote" teaser. Growth/enterprise: phone.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, ArrowRight, PhoneCall } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'final-cta-quote',
  category: 'finalCta',
  label: 'Final CTA / Quote Teaser',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['contrast', 'editorial', 'quiet'],
  leadMode: 'phone',
} as const;

export default function FinalCtaQuote({
  content = CONTENT,
  skin = 'contrast',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const dark = skin === 'contrast';
  const { finalCta, brand } = content;

  return (
    <section id="cta" className={`px-6 py-24 ${s.section}`}>
      <motion.div
        className={`mx-auto grid max-w-5xl overflow-hidden rounded-[28px] border ${s.cardRule} ${s.card} lg:grid-cols-[1.2fr_1fr]`}
        initial={still ? false : { opacity: 0, y: 18 }}
        whileInView={still ? undefined : { opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.55, ease: EASE }}
      >
        {/* Left: the pitch */}
        <div className="p-9 sm:p-12">
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
          </p>
          <h2 className={`mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] ${s.heading} md:text-5xl`}><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className={`mt-4 max-w-md leading-relaxed ${s.body}`}><E p="finalCta.sub">{finalCta.sub}</E></p>
          <a href={brand.phoneHref} className={`mt-7 inline-flex items-center gap-2 text-sm font-medium ${s.body} hover:text-accent`}>
            <PhoneCall size={15} weight="bold" className="text-accent" />
            or call <E p="brand.phone">{brand.phone}</E>
          </a>
        </div>

        {/* Right: accent panel with checklist + CTA */}
        <div className={`flex flex-col justify-center gap-6 border-t p-9 sm:p-12 lg:border-l lg:border-t-0 ${dark ? 'border-ruleInk bg-inkPanel2' : 'border-rule bg-accent/[0.06]'}`}>
          {finalCta.frictionReducers?.length > 0 && (
            <ul className="space-y-3">
              {finalCta.frictionReducers.map((r, i) => (
                <li key={r} className={`flex items-center gap-2.5 text-sm font-medium ${s.heading}`}>
                  <CheckCircle size={18} weight="fill" className="text-accent" />
                  <E p={`finalCta.frictionReducers.${i}`}>{r}</E>
                </li>
              ))}
            </ul>
          )}
          <a
            href="#cta"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-7 py-4 font-semibold text-accentFg transition-transform hover:-translate-y-0.5"
            style={{ boxShadow: dark ? '4px 4px 0px 0px rgba(255,255,255,0.14)' : '4px 4px 0px 0px rgba(0,0,0,0.85)' }}
          >
            <E p="finalCta.cta">{finalCta.cta}</E>
            <ArrowRight size={17} weight="bold" className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </motion.div>
    </section>
  );
}
