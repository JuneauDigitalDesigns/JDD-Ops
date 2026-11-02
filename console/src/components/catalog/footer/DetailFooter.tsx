'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailFooter — near-black footer, mirrored 1:1 (#detail footer.ftr). Same structure as
// HvacFooter (brand column + client link columns + derived contact column + legal bar); the
// ground is the mockup's own `--near-black` (#08090C), one step darker than the page's own
// `--bg` (#0D0E12) — not the same literal value, so it stays a hardcoded hex rather than the
// bg-bg token. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone, EnvelopeSimple, MapPin } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'detail-footer',
  category: 'footer',
  label: 'Car Detailing / Footer',
  consumes: ['brand.name', 'brand.tagline', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address', 'footer.blurb', 'footer.cols', 'footer.legal', 'extensions.trustBadges'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function DetailFooter({ content = CONTENT }: { content?: SiteContent }) {
  const { footer, brand, extensions } = content;
  const badges = extensions.trustBadges ?? [];
  const col = 'block py-[5px] text-[14.5px] text-[#AEB7C4] transition-colors hover:text-[#fff]';

  return (
    <footer className="pb-8 pt-16" style={{ background: '#08090C', color: '#6C7686', borderTop: '1px solid #1B1E26' }}>
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.1fr]">
          <div>
            <a href="/" className="flex items-center gap-[11px] text-[#fff]">
              <span
                className="grid h-9 w-9 place-items-center rounded-[8px] text-[#0D0E12] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                style={{ background: 'linear-gradient(145deg,#C9A14B,#8A6A26)' }}
                aria-hidden="true"
              />
              <span className="font-heading text-[22px] font-extrabold leading-none tracking-[-0.016em]">
                <E p="brand.name">{brand.name}</E>
                {brand.tagline && <small className="mt-0.5 block font-sans text-[11px] font-medium text-[#6C7686]"><E p="brand.tagline">{brand.tagline}</E></small>}
              </span>
            </a>
            <p className="mt-4 max-w-[34ch] text-[14.5px] leading-[1.6]"><E p="footer.blurb">{footer.blurb}</E></p>
            {badges.length > 0 && (
              <div className="mt-[18px] flex flex-wrap gap-2">
                {badges.map((b, i) => (
                  <span key={b} className="rounded-[4px] px-[11px] py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-accent" style={{ border: '1px solid rgba(201,161,75,0.3)' }}>
                    <E p={`extensions.trustBadges.${i}`}>{b}</E>
                  </span>
                ))}
              </div>
            )}
          </div>

          {footer.cols.map((c, ci) => (
            <div key={c.h || ci}>
              <h4 className="mb-3.5 font-sans text-[12.5px] font-bold uppercase tracking-[0.12em] text-accent"><E p={`footer.cols.${ci}.h`}>{c.h}</E></h4>
              {c.links.map((l, li) => (
                <a key={l.href + li} href={l.href} className={col}><E p={`footer.cols.${ci}.links.${li}.label`}>{l.label}</E></a>
              ))}
            </div>
          ))}

          <div>
            <h4 className="mb-3.5 font-sans text-[12.5px] font-bold uppercase tracking-[0.12em] text-accent">Contact</h4>
            <a href={brand.phoneHref} className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-[#AEB7C4] hover:text-[#fff]">
              <Phone size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><E p="brand.phone">{brand.phone}</E>
            </a>
            <a href={`mailto:${brand.email}`} className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-[#AEB7C4] hover:text-[#fff]">
              <EnvelopeSimple size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><E p="brand.email">{brand.email}</E>
            </a>
            <span className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-[#AEB7C4]">
              <MapPin size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><E p="brand.address">{brand.address}</E>
            </span>
          </div>
        </div>

        <div className="mt-11 flex flex-wrap justify-between gap-4 pt-[22px] text-[13px]" style={{ borderTop: '1px solid #1B1E26' }}>
          <span><E p="footer.legal">{footer.legal}</E></span>
          {brand.license && <span>Licensed &amp; insured · {brand.license}</span>}
        </div>
      </div>
    </footer>
  );
}
