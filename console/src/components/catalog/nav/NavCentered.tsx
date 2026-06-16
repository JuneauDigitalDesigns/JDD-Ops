'use client';
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PhoneCall } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { useScrolled } from '@/lib/useScrolled';

export const meta = {
  id: 'nav-centered',
  category: 'nav',
  label: 'Nav / Centered',
  consumes: ['nav', 'hero.cta', 'brand.name', 'brand.long', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/useScrolled'],
} as const;

export default function NavCentered({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { brand, nav, hero } = content;
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled();

  return (
    <header className={`sticky top-0 z-50 bg-bg/95 backdrop-blur transition-all duration-200 ${scrolled ? 'border-b border-rule shadow-sm' : 'border-b border-transparent'}`}>
      <div className="mx-auto max-w-6xl px-6 py-4">
        {/* Top row: centered brand, phone + CTA right */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div />
          <a href="#top" className="font-heading text-xl font-bold text-ink"><E p="brand.name">{brand.name}</E></a>
          <div className="flex items-center justify-end gap-3">
            <a href={brand.phoneHref}
              className="hidden items-center gap-1.5 text-sm font-medium text-ink hover:text-accent sm:inline-flex">
              <PhoneCall size={14} weight="bold" className="text-accent" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
            <a href="#cta"
              className="hidden rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accentFg transition-opacity hover:opacity-90 sm:inline-block">
              <E p="hero.cta">{hero.cta}</E>
            </a>
            <button type="button" onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="flex flex-col gap-1.5 sm:hidden">
              <span className={`block h-0.5 w-5 bg-ink transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`} />
              <span className={`block h-0.5 w-5 bg-ink transition-opacity ${open ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 w-5 bg-ink transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`} />
            </button>
          </div>
        </div>

        {/* Nav links row (desktop) */}
        <nav className="mt-3 hidden items-center justify-center gap-6 text-sm sm:flex" aria-label="Main navigation">
          {nav.map((item, i) => (
            <a key={item.href} href={item.href}
              className="font-medium text-inkSoft transition-colors hover:text-ink">
              <E p={`nav.${i}.label`}>{item.label}</E>
            </a>
          ))}
        </nav>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div className="overflow-hidden border-t border-rule sm:hidden"
            initial={reduce ? false : { height: 0 }}
            animate={{ height: 'auto' }}
            exit={reduce ? undefined : { height: 0 }}
            transition={{ duration: 0.22 }}>
            <nav className="px-6 pb-4 pt-3 space-y-1">
              {nav.map((item, i) => (
                <a key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className="block py-2.5 text-sm font-medium text-ink"><E p={`nav.${i}.label`}>{item.label}</E></a>
              ))}
              <a href="#cta" onClick={() => setOpen(false)}
                className="mt-3 block rounded-lg bg-accent px-4 py-3 text-center text-sm font-semibold text-accentFg">
                <E p="hero.cta">{hero.cta}</E>
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
