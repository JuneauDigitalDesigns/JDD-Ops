'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { InstagramLogo, FacebookLogo } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'footer-brand-cta',
  category: 'footer',
  label: 'Footer / Brand + CTA',
  consumes: ['brand.name', 'brand.long', 'brand.license', 'footer.blurb', 'footer.cols', 'footer.social', 'footer.legalLinks', 'footer.legal', 'images.footer.logoImage', 'finalCta.cta'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  Instagram: InstagramLogo,
  Facebook:  FacebookLogo,
};

export default function FooterBrandCta() {
  const reduce = useReducedMotion() ?? false;
  const { brand, footer, images, finalCta } = CONTENT;
  const logo = images.footer.logoImage;

  return (
    <footer className="bg-ink text-bg">
      <div className="mx-auto max-w-6xl px-6 pt-14 pb-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr_auto]">
          {/* Brand block */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {logo ? (
              <img src={logo} alt={brand.name} loading="lazy" className="mb-4 h-8 w-auto object-contain" />
            ) : (
              <p className="mb-4 font-heading text-xl font-bold text-bg">{brand.name}</p>
            )}
            <p className="max-w-xs text-sm leading-relaxed text-bg/70">{footer.blurb}</p>
            {footer.social.length > 0 && (
              <div className="mt-5 flex gap-3">
                {footer.social.map((s) => {
                  const Icon = SOCIAL_ICONS[s.label];
                  return (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                      aria-label={s.label}
                      className="text-bg/50 transition-colors hover:text-bg">
                      {Icon ? <Icon size={20} /> : <span className="text-xs">{s.label}</span>}
                    </a>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Footer columns */}
          {footer.cols.length > 0 && (
            <div className="grid gap-8 sm:grid-cols-2">
              {footer.cols.map((col) => (
                <div key={col.h}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-bg/40">{col.h}</p>
                  <ul className="space-y-2">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <a href={link.href} className="text-sm text-bg/70 hover:text-bg">{link.label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Mini CTA */}
          <div className="flex flex-col gap-3 lg:min-w-[200px]">
            <p className="text-sm font-semibold text-bg">Ready to get started?</p>
            <a href="#cta"
              className="inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accentFg transition-opacity hover:opacity-90 text-center">
              {finalCta.cta}
            </a>
            {brand.license && <p className="text-xs text-bg/40">Lic. {brand.license}</p>}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-bg/40">
          <p>{footer.legal}</p>
          <div className="flex gap-4">
            {footer.legalLinks.map((l) => (
              <a key={l.label} href={l.href} className="hover:text-bg/70">{l.label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
