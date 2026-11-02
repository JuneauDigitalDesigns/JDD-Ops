'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnContact — details on the left, the shared LeadForm on the right. Mirrors HvacContact's
// structure with lawn's 24px-radius, soft-shadow card. The form POSTs {name, phone|email} to
// /api/contact; mode is plan-derived (starter -> email, growth/enterprise -> phone, D11) so
// the Retell callback keeps working.
//
// Hero-picker prefill (D8): LawnHero's "See my price →" links here with ?frequency=<key>. The
// key is mapped through a FIXED WHITELIST (never the raw param echoed — this reaches an owner
// email) to a human-readable string, which seeds LeadForm's optional message field. Reading the
// param needs next/navigation's useSearchParams(), which requires a Suspense boundary or it
// de-opts the whole page out of static generation — so only this one inner piece is wrapped,
// not the page. The Suspense fallback is an unprefilled LeadForm, so the form still works
// before hydration and degrades safely if the param is missing or unmapped. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Envelope, MapPin, Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm, type LeadMode } from '@/lib/LeadForm';

export const meta = {
  id: 'lawn-contact',
  category: 'contact',
  label: 'Lawn / Contact',
  consumes: [
    'finalCta.cta', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address',
    'extensions.contactDetails',
  ],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true,
} as const;

/** Whitelisted frequency -> prefill text. Never derive this from the raw param string. Exported
 *  so lead-form-prefill.test.mjs can assert the mapping directly, without rendering through
 *  next/navigation's router context (useSearchParams needs one; this plain object doesn't). */
export const FREQUENCY_MESSAGES: Record<string, string> = {
  weekly: 'Weekly mowing — quarter-acre',
  biweekly: 'Bi-weekly mowing — quarter-acre',
  onetime: 'One-time cleanup',
};

function ContactForm({ mode, ctaLabel }: { mode: LeadMode; ctaLabel: React.ReactNode }) {
  const params = useSearchParams();
  const initialMessage = FREQUENCY_MESSAGES[params.get('frequency') ?? ''] ?? '';
  return (
    <LeadForm mode={mode} withMessage initialMessage={initialMessage} surface="light" className="mt-3.5" submitLabel={ctaLabel} />
  );
}

export default function LawnContact({ content = CONTENT }: { content?: SiteContent }) {
  const { brand, finalCta, extensions } = content;
  const mode = content._meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const mapsUrl = extensions.contactDetails?.mapsUrl;

  return (
    <section id="contact" className="bg-bg py-[92px]">
      <div className="mx-auto grid max-w-[1140px] items-start gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 text-[16px] text-ink">
          <a href={brand.phoneHref} className="flex items-center gap-3 font-heading text-[21px] font-extrabold">
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

        <div className="rounded-[24px] border border-rule bg-bg p-7 shadow-[0_1px_2px_rgba(22,37,26,0.04)]">
          <h2 className="font-heading text-[22px] font-extrabold text-ink">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h2>
          <Suspense fallback={<LeadForm mode={mode} withMessage surface="light" className="mt-3.5" submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>} />}>
            <ContactForm mode={mode} ctaLabel={<E p="finalCta.cta">{finalCta.cta}</E>} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
