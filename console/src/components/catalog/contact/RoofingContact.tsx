'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingContact — premium pass (2026-11-09, approved mockup's roofing language). Details on the
// left as a hairline list, the shared LeadForm on the right in a white card with the emphasis-
// colour top rule (the storm card's language) and the premium shadow, 6px lower corners. The
// form POSTs {name, phone|email} to /api/contact; mode is plan-derived (starter -> email,
// growth/enterprise -> phone, D11) so the Retell callback keeps working. The mapsUrl link/div
// split is kept. Colours are palette tokens (ink, ink-soft, rule, accent, --accent-2).
// ─────────────────────────────────────────────────────────────────────────────
import { Envelope, MapPin, Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

export const meta = {
  id: 'roofing-contact',
  category: 'contact',
  label: 'Roofing / Contact',
  consumes: [
    'finalCta.cta', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address',
    'extensions.contactDetails',
  ],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function RoofingContact({ content = CONTENT }: { content?: SiteContent }) {
  const { brand, finalCta, extensions } = content;
  const mode = content._meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const mapsUrl = extensions.contactDetails?.mapsUrl;
  const row = 'flex items-start gap-3 border-b border-rule py-4';

  return (
    <section id="contact" className="bg-bg py-16 lg:py-[88px]">
      <div className="mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
        <div className="min-w-0 border-t border-rule text-[16px] text-ink">
          <a href={brand.phoneHref} className={`${row} font-heading text-[22px] font-extrabold tracking-[-0.024em]`}>
            <Phone size={20} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
          {brand.email && (
            <a href={`mailto:${brand.email}`} className={`${row} break-all font-semibold text-inkSoft transition-colors hover:text-ink`}>
              <Envelope size={18} weight="bold" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <E p="brand.email">{brand.email}</E>
            </a>
          )}
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={`${row} text-inkSoft transition-colors hover:text-ink`}>
              <MapPin size={18} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <E p="brand.address">{brand.address}</E>
            </a>
          ) : (
            <div className={`${row} text-inkSoft`}>
              <MapPin size={18} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <E p="brand.address">{brand.address}</E>
            </div>
          )}
        </div>

        <div className="shadow-brand-3 rounded-b-[6px] border border-t-4 border-rule border-t-[color:var(--accent-2)] bg-bg p-6 sm:p-7">
          <h2 className="font-heading text-[22px] font-extrabold tracking-[-0.024em] text-ink">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h2>
          <LeadForm
            mode={mode}
            withMessage
            surface="light"
            className="mt-3.5"
            submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>}
          />
        </div>
      </div>
    </section>
  );
}
