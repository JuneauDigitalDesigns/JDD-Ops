'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingFooter — deep-blue footer, mirrored 1:1 (#plumbing footer.ftr). Same structure as
// HvacFooter (brand column + client link columns + derived contact column + legal bar) with
// plumbing's own deep-2 ground and credential badges. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone, EnvelopeSimple, MapPin } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'plumbing-footer',
  category: 'footer',
  label: 'Plumbing / Footer',
  consumes: ['brand.name', 'brand.tagline', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address', 'footer.blurb', 'footer.cols', 'footer.legal', 'extensions.trustBadges'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function PlumbingFooter({ content = CONTENT }: { content?: SiteContent }) {
  const { footer, brand, extensions } = content;
  const badges = extensions.trustBadges ?? [];
  const col = 'block py-[5px] text-[14.5px] text-[#C3D7E3] transition-colors hover:text-[#fff]';

  return (
    <footer className="pb-8 pt-16" style={{ background: '#08202F', color: '#9FB6C4' }}>
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.1fr]">
          <div>
            <a href="/" className="flex items-center gap-[11px] text-[#fff]">
              <span
                className="grid h-9 w-9 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                style={{ background: 'linear-gradient(145deg,#2E8AC6,#1E6FA8)' }}
                aria-hidden="true"
              />
              <span className="font-heading text-[22px] font-extrabold leading-none tracking-[-0.018em]">
                <E p="brand.name">{brand.name}</E>
                {brand.tagline && <small className="mt-0.5 block font-sans text-[11px] font-medium text-[#7F9AAE]"><E p="brand.tagline">{brand.tagline}</E></small>}
              </span>
            </a>
            <p className="mt-4 max-w-[34ch] text-[14.5px] leading-[1.6]"><E p="footer.blurb">{footer.blurb}</E></p>
            {badges.length > 0 && (
              <div className="mt-[18px] flex flex-wrap gap-2">
                {badges.map((b, i) => (
                  <span key={b} className="rounded-full border px-3 py-1.5 text-[12px]" style={{ borderColor: 'rgba(255,255,255,0.13)' }}>
                    <E p={`extensions.trustBadges.${i}`}>{b}</E>
                  </span>
                ))}
              </div>
            )}
          </div>

          {footer.cols.map((c, ci) => (
            <div key={c.h || ci}>
              <h4 className="mb-3.5 font-sans text-[12.5px] font-bold uppercase tracking-[0.12em]" style={{ color: '#7F9AAE' }}><E p={`footer.cols.${ci}.h`}>{c.h}</E></h4>
              {c.links.map((l, li) => (
                <a key={l.href + li} href={l.href} className={col}><E p={`footer.cols.${ci}.links.${li}.label`}>{l.label}</E></a>
              ))}
            </div>
          ))}

          <div>
            <h4 className="mb-3.5 font-sans text-[12.5px] font-bold uppercase tracking-[0.12em]" style={{ color: '#7F9AAE' }}>Contact</h4>
            <a href={brand.phoneHref} className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-[#C3D7E3] hover:text-[#fff]">
              <Phone size={16} weight="fill" className="mt-0.5 shrink-0 text-[#6FC4F5]" aria-hidden="true" /><E p="brand.phone">{brand.phone}</E>
            </a>
            <a href={`mailto:${brand.email}`} className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-[#C3D7E3] hover:text-[#fff]">
              <EnvelopeSimple size={16} className="mt-0.5 shrink-0 text-[#6FC4F5]" aria-hidden="true" /><E p="brand.email">{brand.email}</E>
            </a>
            <span className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-[#C3D7E3]">
              <MapPin size={16} weight="fill" className="mt-0.5 shrink-0 text-[#6FC4F5]" aria-hidden="true" /><E p="brand.address">{brand.address}</E>
            </span>
          </div>
        </div>

        <div className="mt-11 flex flex-wrap justify-between gap-4 border-t pt-[22px] text-[13px]" style={{ borderColor: 'rgba(255,255,255,0.13)', color: '#7F9AAE' }}>
          <span><E p="footer.legal">{footer.legal}</E></span>
          {brand.license && <span>Licensed &amp; insured · {brand.license}</span>}
        </div>
      </div>
    </footer>
  );
}
