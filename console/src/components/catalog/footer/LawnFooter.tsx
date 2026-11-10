'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnFooter — "seasonal / organic / airy" footer, premium pass (2026-11-09, approved mockup).
// The forest-dark end of the template (ink-panel): brand column (accent-bar mark + name/tagline +
// blurb + credential badges), the client's link columns from footer.cols (no hardcoded section
// anchors), a derived Contact column, and a legal bar with the license line when intake supplied
// one. Every colour is a palette token (ink-panel, on-ink, on-ink-soft, rule-ink, accent), so the
// Studio reaches all of it. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone, EnvelopeSimple, MapPin } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'lawn-footer',
  category: 'footer',
  label: 'Lawn / Footer',
  consumes: ['brand.name', 'brand.tagline', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address', 'brand.license', 'footer.blurb', 'footer.cols', 'footer.legal', 'extensions.trustBadges'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function LawnFooter({ content = CONTENT }: { content?: SiteContent }) {
  const { footer, brand, extensions } = content;
  const badges = extensions.trustBadges ?? [];
  const col = 'block py-[5px] text-[14.5px] text-onInkSoft transition-colors hover:text-onInk';
  const head = 'mb-3.5 font-sans text-[12.5px] font-bold uppercase tracking-[0.12em] text-onInkSoft';

  return (
    <footer className="bg-inkPanel pb-8 pt-16 text-onInkSoft">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.1fr]">
          {/* Brand */}
          <div className="md:col-span-2 lg:col-span-1">
            <a href="/" className="flex items-center gap-[11px] text-onInk">
              <span className="accent-bar !h-9 !w-9 shrink-0 !rounded-[14px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" aria-hidden="true" />
              <span className="font-heading text-[22px] font-extrabold leading-none tracking-[-0.02em]">
                <E p="brand.name">{brand.name}</E>
                {brand.tagline && <small className="mt-1 block font-sans text-[11px] font-medium tracking-[0.04em] text-onInkSoft"><E p="brand.tagline">{brand.tagline}</E></small>}
              </span>
            </a>
            <p className="mt-4 max-w-[34ch] text-[14.5px] leading-[1.6] text-onInkSoft"><E p="footer.blurb">{footer.blurb}</E></p>
            {badges.length > 0 && (
              <div className="mt-[18px] flex flex-wrap gap-2">
                {badges.map((b, i) => (
                  <span key={b} className="rounded-full border border-ruleInk px-3 py-1.5 text-[12px] text-onInkSoft">
                    <E p={`extensions.trustBadges.${i}`}>{b}</E>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Client link columns */}
          {footer.cols.map((c, ci) => (
            <div key={c.h || ci}>
              <h4 className={head}><E p={`footer.cols.${ci}.h`}>{c.h}</E></h4>
              {c.links.map((l, li) => (
                <a key={l.href + li} href={l.href} className={col}><E p={`footer.cols.${ci}.links.${li}.label`}>{l.label}</E></a>
              ))}
            </div>
          ))}

          {/* Derived contact column */}
          <div>
            <h4 className={head}>Contact</h4>
            <a href={brand.phoneHref} className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-onInkSoft transition-colors hover:text-onInk">
              <Phone size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><E p="brand.phone">{brand.phone}</E>
            </a>
            <a href={`mailto:${brand.email}`} className="flex min-w-0 items-start gap-[9px] break-all py-[5px] text-[14.5px] text-onInkSoft transition-colors hover:text-onInk">
              <EnvelopeSimple size={16} weight="bold" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><E p="brand.email">{brand.email}</E>
            </a>
            <span className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-onInkSoft">
              <MapPin size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><E p="brand.address">{brand.address}</E>
            </span>
          </div>
        </div>

        <div className="mt-11 flex flex-wrap justify-between gap-4 border-t border-ruleInk pt-[22px] text-[13px] text-onInkSoft">
          <span><E p="footer.legal">{footer.legal}</E></span>
          {brand.license && <span>Licensed &amp; insured · {brand.license}</span>}
        </div>
      </div>
    </footer>
  );
}
