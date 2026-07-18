'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { InstagramLogo, FacebookLogo } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'footer-brand-cta',
  category: 'footer',
  label: 'Footer / Brand + CTA',
  consumes: ['brand.name', 'brand.long', 'brand.license', 'footer.blurb', 'footer.cols', 'footer.social', 'footer.legalLinks', 'footer.legal', 'images.footer.logoImage', 'finalCta.cta'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['contrast', 'editorial'],
} as const;

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  Instagram: InstagramLogo,
  Facebook: FacebookLogo,
};

export default function FooterBrandCta({
  content = CONTENT,
  skin = 'contrast',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { brand, footer, images, finalCta } = content;
  const logo = images.footer.logoImage;

  return (
    <footer className={s.section}>
      <div className="mx-auto max-w-6xl px-6 pb-8 pt-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr_auto]">
          {/* Brand block */}
          <motion.div
            initial={still ? false : { opacity: 0, y: 10 }}
            whileInView={still ? undefined : { opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {logo ? (
              <img src={logo} alt={brand.name} loading="lazy" className="mb-4 h-8 w-auto object-contain" />
            ) : (
              <p className={`mb-4 font-heading text-xl font-bold ${s.heading}`}><E p="brand.name">{brand.name}</E></p>
            )}
            <p className={`max-w-xs text-sm leading-relaxed ${s.body}`}><E p="footer.blurb">{footer.blurb}</E></p>
            {footer.social.length > 0 && (
              <div className="mt-5 flex gap-3">
                {footer.social.map((soc, si) => {
                  const Icon = SOCIAL_ICONS[soc.label];
                  return (
                    <a key={soc.label} href={soc.href} target="_blank" rel="noopener noreferrer"
                      aria-label={soc.label}
                      className={`${s.body} transition-colors hover:text-accent`}>
                      {Icon ? <Icon size={20} /> : <span className="text-xs"><E p={`footer.social.${si}.label`}>{soc.label}</E></span>}
                    </a>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Footer columns */}
          {footer.cols.length > 0 && (
            <div className="grid gap-8 sm:grid-cols-2">
              {footer.cols.map((col, ci) => (
                <div key={col.h}>
                  <p className={`mb-3 text-xs font-semibold uppercase tracking-[0.2em] ${s.eyebrow}`}><E p={`footer.cols.${ci}.h`}>{col.h}</E></p>
                  <ul className="space-y-2">
                    {col.links.map((link, li) => (
                      <li key={link.label}>
                        <a href={link.href} className={`text-sm ${s.body} hover:text-accent`}><E p={`footer.cols.${ci}.links.${li}.label`}>{link.label}</E></a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Mini CTA */}
          <div className="flex flex-col gap-3 lg:min-w-[200px]">
            <p className={`text-sm font-semibold ${s.heading}`}>Ready to get started?</p>
            <a href="#cta"
              className="inline-block rounded-full bg-accent px-5 py-2.5 text-center text-sm font-semibold text-accentFg transition-transform hover:-translate-y-0.5">
              <E p="finalCta.cta">{finalCta.cta}</E>
            </a>
            {brand.license && <p className={`text-xs ${s.body}`}>Lic. <E p="brand.license">{brand.license}</E></p>}
          </div>
        </div>

        <div className={`mt-10 flex flex-wrap items-center justify-between gap-3 border-t ${s.rule} pt-6 text-xs ${s.body}`}>
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
