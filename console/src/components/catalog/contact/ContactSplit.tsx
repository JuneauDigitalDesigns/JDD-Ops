'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, Envelope, MapPin, CheckCircle, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'contact-split',
  category: 'contact',
  label: 'Contact / Split form + details',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address', 'extensions.contactDetails'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['default', 'soft'],
} as const;


export default function ContactSplit({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { brand, finalCta, extensions } = content;
  const dark = skin === 'inverted' || skin === 'contrast';
  const mode = content._meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const mapsUrl = extensions.contactDetails?.mapsUrl;

  return (
    <section id="contact" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
        {/* Left: details */}
        <motion.div
          initial={still ? false : { opacity: 0, x: -16 }}
          whileInView={still ? undefined : { opacity: 1, x: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <h2 className={`mt-3 font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className={`mt-3 leading-relaxed ${s.body}`}><E p="finalCta.sub">{finalCta.sub}</E></p>

          <div className="mt-8 space-y-4">
            <a href={brand.phoneHref} className={`flex items-center gap-3 ${s.body} hover:text-accent`}>
              <PhoneCall size={18} className="shrink-0 text-accent" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
            <a href={`mailto:${brand.email}`} className={`flex items-center gap-3 ${s.body} hover:text-accent`}>
              <Envelope size={18} className="shrink-0 text-accent" />
              <E p="brand.email">{brand.email}</E>
            </a>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-3 ${s.body} hover:text-accent`}>
                <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                <E p="brand.address">{brand.address}</E>
              </a>
            ) : (
              <div className={`flex items-start gap-3 ${s.body}`}>
                <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                <E p="brand.address">{brand.address}</E>
              </div>
            )}
          </div>

          {finalCta.frictionReducers.length > 0 && (
            <div className={`mt-8 space-y-3 border-t ${s.rule} pt-8`}>
              {finalCta.frictionReducers.map((r, i) => (
                <div key={r} className={`flex items-center gap-2 text-sm ${s.body}`}>
                  <CheckCircle size={16} weight="fill" className="shrink-0 text-accent" />
                  <E p={`finalCta.frictionReducers.${i}`}>{r}</E>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right: form */}
        <motion.div
          initial={still ? false : { opacity: 0, x: 16 }}
          whileInView={still ? undefined : { opacity: 1, x: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE, delay: 0.07 }}
        >
          {/* This was the best of the four hand-rolled forms — it had real labels and an
              error that named the phone number. It is still a fourth copy of logic that has
              to be right everywhere, so it moves to <LeadForm> with the rest. The one
              behaviour lost is the optional-phone case: LeadForm requires a contact method,
              because a lead with neither a number nor an email cannot be followed up. */}
          <LeadForm
            mode={mode}
            withMessage
            surface={dark ? 'dark' : 'light'}
            submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>}
          />
        </motion.div>
      </div>
    </section>
  );
}
