'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailContact — details on the left, the shared LeadForm on the right, premium pass
// (2026-11-09, approved mockup's material). Mirrors HvacContact's structure: the phone in the
// display face, email and address with accent icons (brighten on hover), and the dark form card
// (ink-panel, rule border) with surface="dark" to match the final CTA's card rather than a white
// card on a dark page. The form POSTs {name, phone|email} to /api/contact; mode is plan-derived
// (starter -> email, growth/enterprise -> phone, D11). Every colour is a palette token.
// ─────────────────────────────────────────────────────────────────────────────
import { Envelope, MapPin, Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

export const meta = {
  id: 'detail-contact',
  category: 'contact',
  label: 'Car Detailing / Contact',
  consumes: [
    'finalCta.cta', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address',
    'extensions.contactDetails',
  ],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function DetailContact({ content = CONTENT }: { content?: SiteContent }) {
  const { brand, finalCta, extensions } = content;
  const mode = content._meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const mapsUrl = extensions.contactDetails?.mapsUrl;

  return (
    <section className="bg-bg py-16 sm:py-24">
      <div className="mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
        <div className="min-w-0 space-y-4 text-[16px] text-ink">
          <a href={brand.phoneHref} className="flex items-center gap-3 font-heading text-[21px] font-extrabold tracking-[-0.016em] transition-colors hover:text-accent">
            <Phone size={20} weight="fill" className="text-accent" aria-hidden="true" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
          {brand.email && (
            <a href={`mailto:${brand.email}`} className="flex items-center gap-3 font-semibold text-inkSoft transition-colors [overflow-wrap:anywhere] hover:text-ink">
              <Envelope size={18} weight="bold" className="shrink-0 text-accent" aria-hidden="true" />
              <E p="brand.email">{brand.email}</E>
            </a>
          )}
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-inkSoft transition-colors hover:text-ink">
              <MapPin size={18} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <E p="brand.address">{brand.address}</E>
            </a>
          ) : (
            <div className="flex items-start gap-3 text-inkSoft">
              <MapPin size={18} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <E p="brand.address">{brand.address}</E>
            </div>
          )}
        </div>

        <div className="rounded-[12px] border border-rule bg-inkPanel p-6 text-onInk sm:p-[30px]">
          <h2 className="font-heading text-[21px] font-extrabold tracking-[-0.02em] text-onInk">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h2>
          <LeadForm mode={mode} withMessage surface="dark" className="mt-3.5" submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>} />
        </div>
      </div>
    </section>
  );
}
