'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, Envelope, MapPin } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'contact-card-overlap',
  category: 'contact',
  label: 'Contact / Overlap cards',
  consumes: ['finalCta.headline', 'finalCta.sub', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address', 'extensions.contactDetails'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion', '@/lib/LeadForm'],
  skins: ['default', 'soft'],
  // No fixed leadMode: it reads _meta.selectedPlan and serves either plan.
} as const;


export default function ContactCardOverlap({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { finalCta, brand, extensions } = content;
  const mapsUrl = extensions.contactDetails?.mapsUrl;
  const mode = content._meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <section id="contact" className={`py-24 ${s.section}`}>
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* Details card — always a dark, accent-lit panel: the signature of this layout */}
          <motion.div
            className="relative overflow-hidden rounded-[28px] p-8 text-onInk shadow-xl lg:sticky lg:top-24"
            style={{ background: 'radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--accent) 35%, transparent), transparent 60%), var(--ink-panel)' }}
            initial={still ? false : { opacity: 0, y: 16 }}
            whileInView={still ? undefined : { opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.01em] text-onInk"><E p="finalCta.headline">{finalCta.headline}</E></h2>
            <p className="mt-3 text-onInkSoft"><E p="finalCta.sub">{finalCta.sub}</E></p>
            <div className="mt-8 space-y-4">
              <a href={brand.phoneHref} className="flex items-center gap-3 text-onInk/90 hover:text-onInk">
                <PhoneCall size={18} className="shrink-0 text-accent" weight="bold" />
                <E p="brand.phone">{brand.phone}</E>
              </a>
              <a href={`mailto:${brand.email}`} className="flex items-center gap-3 text-onInk/90 hover:text-onInk">
                <Envelope size={18} className="shrink-0 text-accent" />
                <E p="brand.email">{brand.email}</E>
              </a>
              {mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-3 text-onInk/90 hover:text-onInk">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                  <E p="brand.address">{brand.address}</E>
                </a>
              ) : (
                <div className="flex items-start gap-3 text-onInk/90">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                  <E p="brand.address">{brand.address}</E>
                </div>
              )}
            </div>
          </motion.div>

          {/* Form card */}
          <motion.div
            className={`relative z-10 rounded-[28px] border ${s.cardRule} ${s.card} p-8 shadow-xl lg:-ml-10 lg:mt-12`}
            initial={still ? false : { opacity: 0, y: 24 }}
            whileInView={still ? undefined : { opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.5, ease: EASE, delay: 0.08 }}
          >
            {/* The old inline form had placeholder-only inputs (a placeholder is not an
                accessible name) and a "Something went wrong." with no recovery route.
                <LeadForm> owns labels, validation, aria-invalid, the sent state and an error
                that points at the phone number. */}
            <h3 className={`font-heading text-xl font-bold ${s.heading}`}>Get a free estimate</h3>
            <LeadForm
              mode={mode}
              className="mt-5"
              submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
