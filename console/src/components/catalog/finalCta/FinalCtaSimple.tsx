'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FinalCtaSimple — the deliberately-minimal variant, elevated (see DESIGN-LANGUAGE.md).
// Oversized centered headline, hairline eyebrow, offset-shadow CTA + call link.
// Growth/enterprise: phone.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, ArrowRight } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'finalcta-simple',
  category: 'finalCta',
  label: 'Final CTA / Simple',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.secondary', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
  leadMode: 'phone',
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'centered-statement',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
} as const;

export default function FinalCtaSimple({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { finalCta, brand } = content;
  // On a single-page site #contact resolves on the same page. On a multipage site there is no
  // home-page #contact section to land on, so the CTA must route to the dedicated Contact page
  // instead (nav carries '/contact' there — see navLinksFor, pages.ts).
  const contactHref = content.nav?.some((n) => n.href === '/contact') ? '/contact' : '#contact';

  return (
    <section id="cta" className="bg-bgSoft py-28 text-center">
      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="mx-auto mt-6 max-w-2xl font-heading text-5xl font-bold leading-[0.92] tracking-[-0.035em] text-ink md:text-6xl"><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className="mx-auto mt-5 max-w-lg leading-relaxed text-inkSoft"><E p="finalCta.sub">{finalCta.sub}</E></p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
            <a
              href={contactHref}
              className="group inline-flex items-center gap-2 rounded-sm bg-accent px-8 py-4 font-semibold text-accentFg transition-transform hover:-translate-y-0.5"
              style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,0.85)' }}
            >
              <E p="finalCta.cta">{finalCta.cta}</E>
              <ArrowRight size={17} weight="bold" className="transition-transform group-hover:translate-x-1" />
            </a>
            {finalCta.secondary && (
              <a href={brand.phoneHref} className="inline-flex items-center gap-2 font-medium text-ink hover:text-accent">
                <PhoneCall size={16} weight="bold" className="text-accent" />
                {finalCta.secondary.replace('Call ', '')}
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
