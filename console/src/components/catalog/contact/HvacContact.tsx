'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacContact — Northstar contact block. Details on the left, the shared
// LeadForm on the right. The form POSTs {name, phone|email} to /api/contact.
// Starter captures email; Growth and Enterprise capture a phone. onboard.js
// sets LEAD_DELIVERY_MODE to match, and owns the Resend / Retell route.
// Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Envelope, MapPin, Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

export const meta = {
  id: 'hvac-contact',
  category: 'contact',
  label: 'HVAC / Contact',
  consumes: [
    'finalCta.cta', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address',
    'extensions.contactDetails',
  ],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function HvacContact({ content = CONTENT }: { content?: SiteContent }) {
  const { brand, finalCta, extensions } = content;
  const mode = content._meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const mapsUrl = extensions.contactDetails?.mapsUrl;

  return (
    <section id="contact" className="bg-bg py-[84px]">
      <div className="mx-auto grid max-w-[1120px] items-start gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 text-[16px] text-ink">
          <a href={brand.phoneHref} className="flex items-center gap-3 font-heading text-[21px] font-semibold">
            <Phone size={20} weight="fill" className="text-accent" aria-hidden="true" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
          <a href={`mailto:${brand.email}`} className="flex items-center gap-3 font-semibold text-inkSoft hover:text-ink">
            <Envelope size={18} className="text-accent" aria-hidden="true" />
            <E p="brand.email">{brand.email}</E>
          </a>
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-inkSoft hover:text-ink">
              <MapPin size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <E p="brand.address">{brand.address}</E>
            </a>
          ) : (
            <div className="flex items-start gap-3 text-inkSoft">
              <MapPin size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <E p="brand.address">{brand.address}</E>
            </div>
          )}
        </div>

        <div className="rounded-[18px] border border-rule bg-bg p-7 shadow-[0_4px_10px_rgba(19,41,63,0.08),0_26px_50px_-16px_rgba(19,41,63,0.30)]">
          <h2 className="font-heading text-[22px] font-semibold text-ink">
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
