'use client';
import type { CSSProperties } from 'react';
import { PhoneCall, Envelope, MapPin, InstagramLogo, FacebookLogo } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'footer-columns',
  category: 'footer',
  label: 'Footer / Columns',
  consumes: ['brand.name', 'brand.long', 'brand.license', 'brand.established', 'brand.address', 'brand.phone', 'brand.phoneHref', 'brand.email', 'footer.blurb', 'footer.cols', 'footer.social', 'footer.legalLinks', 'footer.legal'],
  sharedDeps: ['@phosphor-icons/react'],
} as const;

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  Instagram: InstagramLogo,
  Facebook:  FacebookLogo,
};

export default function FooterColumns() {
  const { brand, footer } = CONTENT;
  return (
    <footer className="border-t border-rule bg-bg px-6 pt-12 pb-6">
      <div className="mx-auto max-w-6xl">
        <div
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[var(--footer-cols)]"
          style={{ '--footer-cols': `1.5fr 1fr${footer.cols.length > 0 ? ` repeat(${footer.cols.length},1fr)` : ''}` } as CSSProperties}
        >
          {/* Company */}
          <div>
            <p className="font-heading text-lg font-semibold text-ink">{brand.long}</p>
            {brand.established && (
              <p className="mt-1 text-sm text-inkSoft">{brand.established}</p>
            )}
            {brand.license && (
              <p className="mt-1 text-sm text-inkSoft">Lic. {brand.license}</p>
            )}
            {footer.blurb && (
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-inkSoft">{footer.blurb}</p>
            )}
            {footer.social.length > 0 && (
              <div className="mt-4 flex gap-3">
                {footer.social.map((s) => {
                  const Icon = SOCIAL_ICONS[s.label];
                  return (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                      aria-label={s.label}
                      className="text-inkSoft transition-colors hover:text-accent">
                      {Icon ? <Icon size={18} /> : <span className="text-xs">{s.label}</span>}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contact */}
          <div>
            <p className="font-medium text-ink">Contact</p>
            <div className="mt-3 space-y-2.5 text-sm">
              <a href={brand.phoneHref} className="flex items-center gap-2 text-inkSoft hover:text-accent">
                <PhoneCall size={15} className="shrink-0 text-accent" />
                {brand.phone}
              </a>
              <a href={`mailto:${brand.email}`} className="flex items-center gap-2 text-inkSoft hover:text-accent">
                <Envelope size={15} className="shrink-0 text-accent" />
                {brand.email}
              </a>
              {brand.address && (
                <div className="flex items-start gap-2 text-inkSoft">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-accent" />
                  {brand.address}
                </div>
              )}
            </div>
          </div>

          {/* Footer columns from schema */}
          {footer.cols.map((col) => (
            <div key={col.h}>
              <p className="font-medium text-ink">{col.h}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-inkSoft transition-colors hover:text-accent">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-6 text-xs text-inkSoft">
          <p>{footer.legal}</p>
          <div className="flex gap-4">
            {footer.legalLinks.map((l) => (
              <a key={l.label} href={l.href} className="hover:text-accent">{l.label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
