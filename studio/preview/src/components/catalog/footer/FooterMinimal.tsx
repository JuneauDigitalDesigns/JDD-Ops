'use client';
import { PhoneCall, Envelope, InstagramLogo, FacebookLogo } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'footer-minimal',
  category: 'footer',
  label: 'Footer / Minimal',
  consumes: ['brand.name', 'brand.long', 'brand.license', 'brand.phone', 'brand.phoneHref', 'brand.email', 'footer.blurb', 'footer.social', 'footer.legalLinks', 'footer.legal'],
  sharedDeps: ['@phosphor-icons/react'],
} as const;

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  Instagram: InstagramLogo,
  Facebook:  FacebookLogo,
};

export default function FooterMinimal() {
  const { brand, footer } = CONTENT;
  return (
    <footer className="border-t border-rule bg-bg px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Top row: blurb + social */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-inkSoft">{footer.blurb}</p>
          {footer.social.length > 0 && (
            <div className="flex items-center gap-3">
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

        {/* Bottom row: legal + contact */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-inkSoft">
          <p>
            {footer.legal}
            {brand.license ? ` · Lic. ${brand.license}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {footer.legalLinks.length > 0 ? (
              footer.legalLinks.map((l) => (
                <a key={l.label} href={l.href} className="hover:text-accent">{l.label}</a>
              ))
            ) : (
              <>
                <a href={brand.phoneHref} className="flex items-center gap-1.5 text-accent hover:underline">
                  <PhoneCall size={14} weight="bold" />
                  {brand.phone}
                </a>
                <a href={`mailto:${brand.email}`} className="flex items-center gap-1.5 hover:text-accent">
                  <Envelope size={14} />
                  {brand.email}
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
