'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailContact — details on the left, the shared LeadForm on the right. Mirrors HvacContact's
// structure; bg-bg/text-ink resolve dark automatically from this vertical's palette, and the
// form card uses surface="dark" to match the mockup's dark cta-form treatment rather than a
// white card on a dark page. The form POSTs {name, phone|email} to /api/contact; mode is
// plan-derived (starter -> email, growth/enterprise -> phone, D11). Fixed design, no skin.
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
    <section className="bg-bg py-[92px]">
      <div className="mx-auto grid max-w-[1180px] items-start gap-12 px-6 lg:grid-cols-[0.9fr_1.1fr]">
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

        <div className="rounded-[14px] p-[30px]" style={{ background: '#08090C', border: '1px solid #23262F' }}>
          <h2 className="font-heading text-[21px] font-extrabold text-[#fff]">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h2>
          <LeadForm mode={mode} withMessage surface="dark" className="mt-3.5" submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>} />
        </div>
      </div>
    </section>
  );
}
