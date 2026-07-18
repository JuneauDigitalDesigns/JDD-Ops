'use client';
import { PhoneCall, Envelope, InstagramLogo, FacebookLogo } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'footer-minimal',
  category: 'footer',
  label: 'Footer / Minimal',
  consumes: ['brand.name', 'brand.long', 'brand.license', 'brand.phone', 'brand.phoneHref', 'brand.email', 'footer.blurb', 'footer.social', 'footer.legalLinks', 'footer.legal'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins'],
  skins: ['editorial', 'contrast', 'quiet'],
} as const;

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  Instagram: InstagramLogo,
  Facebook: FacebookLogo,
};

export default function FooterMinimal({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const { brand, footer } = content;
  return (
    <footer className={`border-t ${s.rule} ${s.section} px-6 py-8`}>
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Top row: blurb + social */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className={`text-sm ${s.body}`}><E p="footer.blurb">{footer.blurb}</E></p>
          {footer.social.length > 0 && (
            <div className="flex items-center gap-3">
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

        {/* Bottom row: legal + contact */}
        <div className={`flex flex-wrap items-center justify-between gap-4 text-sm ${s.body}`}>
          <p>
            <E p="footer.legal">{footer.legal}</E>
            {brand.license ? <> · Lic. <E p="brand.license">{brand.license}</E></> : ''}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {footer.legalLinks.length > 0 ? (
              footer.legalLinks.map((l, li) => (
                <a key={l.label} href={l.href} className="hover:text-accent"><E p={`footer.legalLinks.${li}.label`}>{l.label}</E></a>
              ))
            ) : (
              <>
                <a href={brand.phoneHref} className="flex items-center gap-1.5 text-accent hover:underline">
                  <PhoneCall size={14} weight="bold" />
                  <E p="brand.phone">{brand.phone}</E>
                </a>
                <a href={`mailto:${brand.email}`} className="flex items-center gap-1.5 hover:text-accent">
                  <Envelope size={14} />
                  <E p="brand.email">{brand.email}</E>
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
