'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FinalCtaSplit — recomposed as an Overlap (see DESIGN-LANGUAGE.md). A branded
// accent-gradient copy panel with the lead form card overlapping its edge via
// negative margin (adapts contact/ContactCardOverlap). Growth/enterprise: phone.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, PhoneCall } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'finalcta-split',
  category: 'finalCta',
  label: 'Final CTA / Split',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.secondary', 'finalCta.frictionReducers', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['default', 'soft'],
} as const;


export default function FinalCtaSplit({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { finalCta, brand } = content;
  const dark = skin === 'inverted' || skin === 'contrast';
  const mode = content._meta?.selectedPlan === 'starter' ? 'email' : 'phone';


  return (
    <section id="cta" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto grid max-w-5xl gap-0 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        {/* Copy panel — branded gradient, always-readable white */}
        <motion.div
          className="relative z-0 overflow-hidden rounded-3xl bg-accent-grad p-10 text-white lg:py-14"
          initial={still ? false : { opacity: 0, x: -16 }}
          whileInView={still ? undefined : { opacity: 1, x: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '22px 22px' }}
          />
          <h2 className="relative mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] md:text-5xl"><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className="relative mt-4 max-w-md leading-relaxed text-white/85"><E p="finalCta.sub">{finalCta.sub}</E></p>

          {finalCta.frictionReducers.length > 0 && (
            <ul className="relative mt-7 space-y-2">
              {finalCta.frictionReducers.map((r, i) => (
                <li key={r} className="flex items-center gap-2 text-sm text-white/90">
                  <CheckCircle size={16} weight="fill" className="text-white" />
                  <E p={`finalCta.frictionReducers.${i}`}>{r}</E>
                </li>
              ))}
            </ul>
          )}

          {finalCta.secondary && (
            <a href={brand.phoneHref} className="relative mt-7 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80">
              <PhoneCall size={16} weight="bold" />
              <E p="finalCta.secondary">{finalCta.secondary}</E>
            </a>
          )}
        </motion.div>

        {/* Form card — overlaps the copy panel */}
        <motion.div
          className={`relative z-10 rounded-2xl border ${s.cardRule} ${s.card} p-8 shadow-2xl lg:my-8 lg:-ml-12`}
          initial={still ? false : { opacity: 0, x: 16 }}
          whileInView={still ? undefined : { opacity: 1, x: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
        >
          {/* Its labels were <label> elements with no `htmlFor` and no input `id`, so they
              were not associated with anything — visually a label, programmatically decoration.
              The example placeholders ("Jane Smith") also read as prefilled values on some
              screen readers. <LeadForm> owns all of this now. */}
          <LeadForm
            mode={mode}
            surface={dark ? 'dark' : 'light'}
            submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>}
          />
        </motion.div>
      </div>
    </section>
  );
}
