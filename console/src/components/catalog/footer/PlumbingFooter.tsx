'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingFooter — deep-navy footer, premium pass (2026-11-09, approved mockup). Same structure as
// HvacFooter: brand column (the round accent-bar mark + name/tagline, blurb, credential badges),
// the client's link columns from footer.cols, a derived Contact column, and the legal bar with the
// license line. Contact icons are accent2 (the light blue). Two columns on a phone with the brand spanning both.
// Every colour is a palette token (ink-panel, on-ink, on-ink-soft, rule-ink, accent-2), so the
// Studio reaches it. Fixed design, no skin.
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
  const col = 'block py-[5px] text-[14.5px] text-onInkSoft transition-colors hover:text-onInk';
  const contact = 'flex items-start gap-[9px] py-[5px] text-[14.5px] text-onInkSoft';
  const head = 'mb-3.5 font-sans text-[12.5px] font-bold uppercase tracking-[0.12em] text-onInkSoft';

  return (
    <footer className="bg-inkPanel pb-8 pt-16 text-onInkSoft">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="grid grid-cols-2 gap-7 md:gap-10 lg:grid-cols-[1.6fr_1fr_1fr_1.1fr]">
          <div className="col-span-2 lg:col-span-1">
            <a href="/" className="flex items-center gap-[11px] text-onInk">
              <span className="accent-bar !h-9 !w-9 shrink-0 !rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" aria-hidden="true" />
              <span className="font-heading text-[22px] font-extrabold leading-none tracking-[-0.02em]">
                <E p="brand.name">{brand.name}</E>
                {brand.tagline && <small className="mt-1 block font-sans text-[11px] font-medium tracking-[0.04em] text-onInkSoft"><E p="brand.tagline">{brand.tagline}</E></small>}
              </span>
            </a>
            <p className="mt-4 max-w-[34ch] text-[14.5px] leading-[1.6]"><E p="footer.blurb">{footer.blurb}</E></p>
            {badges.length > 0 && (
              <div className="mt-[18px] flex flex-wrap gap-2">
                {badges.map((b, i) => (
                  <span key={b} className="rounded-full border border-ruleInk px-3 py-1.5 text-[12px]">
                    <E p={`extensions.trustBadges.${i}`}>{b}</E>
                  </span>
                ))}
              </div>
            )}
          </div>

          {footer.cols.map((c, ci) => (
            <div key={c.h || ci}>
              <h4 className={head}><E p={`footer.cols.${ci}.h`}>{c.h}</E></h4>
              {c.links.map((l, li) => (
                <a key={l.href + li} href={l.href} className={col}><E p={`footer.cols.${ci}.links.${li}.label`}>{l.label}</E></a>
              ))}
            </div>
          ))}

          <div className="min-w-0">
            <h4 className={head}>Contact</h4>
            <a href={brand.phoneHref} className={`${contact} transition-colors hover:text-onInk`}>
              <Phone size={16} weight="fill" className="mt-0.5 shrink-0 text-[color:var(--accent-2)]" aria-hidden="true" /><E p="brand.phone">{brand.phone}</E>
            </a>
            <a href={`mailto:${brand.email}`} className={`${contact} break-all transition-colors hover:text-onInk`}>
              <EnvelopeSimple size={16} weight="bold" className="mt-0.5 shrink-0 text-[color:var(--accent-2)]" aria-hidden="true" /><E p="brand.email">{brand.email}</E>
            </a>
            <span className={contact}>
              <MapPin size={16} weight="fill" className="mt-0.5 shrink-0 text-[color:var(--accent-2)]" aria-hidden="true" /><E p="brand.address">{brand.address}</E>
            </span>
          </div>
        </div>

        <div className="mt-11 flex flex-wrap justify-between gap-4 border-t border-ruleInk pt-[22px] text-[13px]">
          <span><E p="footer.legal">{footer.legal}</E></span>
          {brand.license && <span>Licensed &amp; insured · {brand.license}</span>}
        </div>
      </div>
    </footer>
  );
}
