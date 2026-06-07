'use client';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PhoneCall } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'nav-split-cta',
  category: 'nav',
  label: 'Nav / Split CTA',
  consumes: ['nav', 'hero.cta', 'brand.name', 'brand.long', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function NavSplitCta() {
  const reduce = useReducedMotion() ?? false;
  const { brand, nav, hero } = CONTENT;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header className={`sticky top-0 z-40 bg-bg/95 backdrop-blur transition-all duration-200 ${scrolled ? 'border-b border-rule shadow-sm' : ''}`}>
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-4">
        {/* Brand (left) */}
        <a href="#top" className="font-heading text-lg font-bold text-ink">{brand.name}</a>

        {/* Nav (center) */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {nav.map((item) => (
            <a key={item.label} href={item.href}
              className="group relative px-3 py-1.5 text-sm font-medium text-inkSoft transition-colors hover:text-ink">
              {item.label}
              <span className="absolute inset-x-3 bottom-0 h-px scale-x-0 bg-accent transition-transform group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        {/* Phone + CTA (right) */}
        <div className="flex items-center justify-end gap-3">
          <a href={brand.phoneHref}
            className="hidden items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-accent lg:flex">
            <PhoneCall size={15} weight="bold" className="text-accent" />
            {brand.phone}
          </a>
          <a href="#cta"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90">
            {hero.cta}
          </a>

          {/* Burger */}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex flex-col gap-1.5 lg:hidden">
            <span className={`block h-0.5 w-5 bg-ink transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-5 bg-ink transition-opacity ${open ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 bg-ink transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="overflow-hidden border-t border-rule lg:hidden"
            initial={reduce ? false : { height: 0 }}
            animate={{ height: 'auto' }}
            exit={reduce ? undefined : { height: 0 }}
            transition={{ duration: 0.22 }}>
            <nav className="px-6 pb-5 pt-3 space-y-1">
              {nav.map((item) => (
                <a key={item.label} href={item.href} onClick={() => setOpen(false)}
                  className="block py-2 text-sm font-medium text-ink">{item.label}</a>
              ))}
              <a href="#cta" onClick={() => setOpen(false)}
                className="mt-3 block rounded-lg bg-accent px-4 py-3 text-center text-sm font-semibold text-bg">
                {hero.cta}
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
