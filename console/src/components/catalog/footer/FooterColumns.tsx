'use client';
import type { CSSProperties } from 'react';
import { PhoneCall, Envelope, MapPin, InstagramLogo, FacebookLogo } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'footer-columns',
  category: 'footer',
  label: 'Footer / Columns',
  consumes: ['brand.name', 'brand.long', 'brand.license', 'brand.established', 'brand.address', 'brand.phone', 'brand.phoneHref', 'brand.email', 'footer.blurb', 'footer.cols', 'footer.social', 'footer.legalLinks', 'footer.legal'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins'],
  skins: ['editorial', 'contrast'],
} as const;

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  Instagram: InstagramLogo,
  Facebook: FacebookLogo,
};

export default function FooterColumns({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const { brand, footer } = content;
  return (
    <footer className={`border-t ${s.rule} ${s.section} px-6 pb-6 pt-14`}>
      <div className="mx-auto max-w-6xl">
        <div
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[var(--footer-cols)]"
          style={{ '--footer-cols': `1.5fr 1fr${footer.cols.length > 0 ? ` repeat(${footer.cols.length},1fr)` : ''}` } as CSSProperties}
        >
          {/* Company */}
          <div>
            <p className={`font-heading text-lg font-bold ${s.heading}`}><E p="brand.long">{brand.long}</E></p>
            {brand.established && (
              <p className={`mt-1 text-sm ${s.body}`}><E p="brand.established">{brand.established}</E></p>
            )}
            {brand.license && (
              <p className={`mt-1 text-sm ${s.body}`}>Lic. <E p="brand.license">{brand.license}</E></p>
            )}
            {footer.blurb && (
              <p className={`mt-3 max-w-xs text-sm leading-relaxed ${s.body}`}><E p="footer.blurb">{footer.blurb}</E></p>
            )}
            {footer.social.length > 0 && (
              <div className="mt-4 flex gap-3">
                {footer.social.map((soc, si) => {
                  const Icon = SOCIAL_ICONS[soc.label];
                  return (
                    <a key={soc.label} href={soc.href} target="_blank" rel="noopener noreferrer"
                      aria-label={soc.label}
                      className={`${s.body} transition-colors hover:text-accent`}>
                      {Icon ? <Icon size={18} /> : <span className="text-xs"><E p={`footer.social.${si}.label`}>{soc.label}</E></span>}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contact */}
          <div>
            <p className={`font-semibold ${s.heading}`}>Contact</p>
            <div className="mt-3 space-y-2.5 text-sm">
              <a href={brand.phoneHref} className={`flex items-center gap-2 ${s.body} hover:text-accent`}>
                <PhoneCall size={15} className="shrink-0 text-accent" />
                <E p="brand.phone">{brand.phone}</E>
              </a>
              <a href={`mailto:${brand.email}`} className={`flex items-center gap-2 ${s.body} hover:text-accent`}>
                <Envelope size={15} className="shrink-0 text-accent" />
                <E p="brand.email">{brand.email}</E>
              </a>
              {brand.address && (
                <div className={`flex items-start gap-2 ${s.body}`}>
                  <MapPin size={15} className="mt-0.5 shrink-0 text-accent" />
                  <E p="brand.address">{brand.address}</E>
                </div>
              )}
            </div>
          </div>

          {/* Footer columns from schema */}
          {footer.cols.map((col, ci) => (
            <div key={col.h}>
              <p className={`font-semibold ${s.heading}`}><E p={`footer.cols.${ci}.h`}>{col.h}</E></p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link, li) => (
                  <li key={link.label}>
                    <a href={link.href} className={`text-sm ${s.body} transition-colors hover:text-accent`}>
                      <E p={`footer.cols.${ci}.links.${li}.label`}>{link.label}</E>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom strip */}
        <div className={`mt-8 flex flex-wrap items-center justify-between gap-2 border-t ${s.rule} pt-6 text-xs ${s.body}`}>
          <p><E p="footer.legal">{footer.legal}</E></p>
          <div className="flex gap-4">
            {footer.legalLinks.map((l, li) => (
              <a key={l.label} href={l.href} className="hover:text-accent"><E p={`footer.legalLinks.${li}.label`}>{l.label}</E></a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
