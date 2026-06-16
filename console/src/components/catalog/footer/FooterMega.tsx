'use client';
import { InstagramLogo, FacebookLogo, PhoneCall, Envelope } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'footer-mega',
  category: 'footer',
  label: 'Footer / Mega',
  consumes: ['brand.name', 'brand.long', 'brand.license', 'brand.phone', 'brand.phoneHref', 'brand.email', 'footer.blurb', 'footer.cols', 'footer.social', 'footer.legalLinks', 'footer.legal', 'extensions.hours'],
  sharedDeps: ['@phosphor-icons/react'],
} as const;

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  Instagram: InstagramLogo,
  Facebook:  FacebookLogo,
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function FooterMega({ content = CONTENT }: { content?: SiteContent }) {
  const { brand, footer, extensions } = content;
  const hours = extensions.hours;

  return (
    <footer className="bg-ink text-bg">
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-8">
        {/* Top row */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(2,1fr)_1.5fr]">
          {/* Brand */}
          <div>
            <p className="font-heading text-xl font-bold"><E p="brand.name">{brand.name}</E></p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-bg/60"><E p="footer.blurb">{footer.blurb}</E></p>
            <div className="mt-5 space-y-2">
              <a href={brand.phoneHref} className="flex items-center gap-2 text-sm text-bg/70 hover:text-bg">
                <PhoneCall size={15} className="shrink-0 text-accent" />
                <E p="brand.phone">{brand.phone}</E>
              </a>
              <a href={`mailto:${brand.email}`} className="flex items-center gap-2 text-sm text-bg/70 hover:text-bg">
                <Envelope size={15} className="shrink-0 text-accent" />
                <E p="brand.email">{brand.email}</E>
              </a>
            </div>
            {footer.social.length > 0 && (
              <div className="mt-4 flex gap-3">
                {footer.social.map((s, si) => {
                  const Icon = SOCIAL_ICONS[s.label];
                  return (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                      className="text-bg/40 hover:text-bg">
                      {Icon ? <Icon size={18} /> : <span className="text-xs"><E p={`footer.social.${si}.label`}>{s.label}</E></span>}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer columns */}
          {footer.cols.map((col, ci) => (
            <div key={col.h}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-bg/40"><E p={`footer.cols.${ci}.h`}>{col.h}</E></p>
              <ul className="space-y-2">
                {col.links.map((link, li) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-bg/70 hover:text-bg"><E p={`footer.cols.${ci}.links.${li}.label`}>{link.label}</E></a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Hours */}
          {hours && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-bg/40">Hours</p>
              <ul className="space-y-1.5">
                {DAYS.filter((d) => hours[d]).map((d) => (
                  <li key={d} className="flex justify-between gap-3 text-sm text-bg/70">
                    <span>{d.slice(0, 3)}</span>
                    <span>{hours[d]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Bottom strip */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-bg/40">
          <p>
            <E p="footer.legal">{footer.legal}</E>
            {brand.license ? <> · Lic. <E p="brand.license">{brand.license}</E></> : ''}
          </p>
          <div className="flex gap-4">
            {footer.legalLinks.map((l, li) => (
              <a key={l.label} href={l.href} className="hover:text-bg/70"><E p={`footer.legalLinks.${li}.label`}>{l.label}</E></a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
