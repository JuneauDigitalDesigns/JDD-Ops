'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnFooter — "seasonal / organic / airy" footer, mirrored from the approved mockup
// (#lawn footer.ftr). Forest-dark (#14301C), sun-gold column heads — the dark end of the
// template's warm palette, not HVAC's navy. Client link columns from footer.cols; derived
// Contact column. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone, EnvelopeSimple, MapPin } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'lawn-footer',
  category: 'footer',
  label: 'Lawn / Footer',
  consumes: ['brand.name', 'brand.tagline', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address', 'footer.blurb', 'footer.cols', 'footer.legal', 'extensions.trustBadges'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function LawnFooter({ content = CONTENT }: { content?: SiteContent }) {
  const { footer, brand, extensions } = content;
  const badges = extensions.trustBadges ?? [];
  const col = 'block py-[5px] text-[14.5px] text-[#C8D8C7] transition-colors hover:text-[#fff]';

  return (
    <footer className="bg-[#14301C] pb-8 pt-16 text-[#A6BAA6]">
      <div className="mx-auto max-w-[1140px] px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.1fr]">
          {/* Brand */}
          <div>
            <a href="/" className="flex items-center gap-[11px] text-[#fff]">
              <span className="grid h-9 w-9 place-items-center rounded-[14px] bg-accent" aria-hidden="true" />
              <span className="font-heading text-[22px] font-extrabold leading-none tracking-[-0.02em]">
                <E p="brand.name">{brand.name}</E>
                {brand.tagline && <small className="mt-0.5 block font-sans text-[11px] font-medium text-[#8A9E8A]"><E p="brand.tagline">{brand.tagline}</E></small>}
              </span>
            </a>
            <p className="mt-4 max-w-[34ch] text-[14.5px] leading-[1.6] text-[#A6BAA6]"><E p="footer.blurb">{footer.blurb}</E></p>
            {badges.length > 0 && (
              <div className="mt-[18px] flex flex-wrap gap-2">
                {badges.map((b, i) => (
                  <span key={b} className="rounded-full border border-[rgba(255,255,255,0.13)] px-3 py-1.5 text-[12px] text-[#A6BAA6]">
                    <E p={`extensions.trustBadges.${i}`}>{b}</E>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Client link columns */}
          {footer.cols.map((c, ci) => (
            <div key={c.h || ci}>
              <h4 className="mb-3.5 font-sans text-[12.5px] font-bold uppercase tracking-[0.12em] text-[#E8B33A]"><E p={`footer.cols.${ci}.h`}>{c.h}</E></h4>
              {c.links.map((l, li) => (
                <a key={l.href + li} href={l.href} className={col}><E p={`footer.cols.${ci}.links.${li}.label`}>{l.label}</E></a>
              ))}
            </div>
          ))}

          {/* Derived contact column */}
          <div>
            <h4 className="mb-3.5 font-sans text-[12.5px] font-bold uppercase tracking-[0.12em] text-[#E8B33A]">Contact</h4>
            <a href={brand.phoneHref} className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-[#C8D8C7] hover:text-[#fff]">
              <Phone size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><E p="brand.phone">{brand.phone}</E>
            </a>
            <a href={`mailto:${brand.email}`} className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-[#C8D8C7] hover:text-[#fff]">
              <EnvelopeSimple size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><E p="brand.email">{brand.email}</E>
            </a>
            <span className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-[#C8D8C7]">
              <MapPin size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><E p="brand.address">{brand.address}</E>
            </span>
          </div>
        </div>

        <div className="mt-11 flex flex-wrap justify-between gap-4 border-t border-[rgba(255,255,255,0.13)] pt-[22px] text-[13px] text-[#A6BAA6]">
          <span><E p="footer.legal">{footer.legal}</E></span>
          {brand.license && <span>Licensed &amp; insured · {brand.license}</span>}
        </div>
      </div>
    </footer>
  );
}
