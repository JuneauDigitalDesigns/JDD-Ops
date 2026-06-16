'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { List, X, PhoneCall } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { useScrolled } from '@/lib/useScrolled';

export const meta = {
  id: 'nav-minimal',
  category: 'nav',
  label: 'Nav / Minimal',
  consumes: ['nav', 'hero.cta', 'brand.name', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/useScrolled'],
} as const;

export default function NavMinimal({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { brand, nav, hero } = content;
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled();

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open]);

  return (
    <header className={`sticky top-0 z-50 border-b border-rule bg-bg/95 backdrop-blur transition-shadow duration-200 ${scrolled ? 'shadow-sm' : ''}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="font-heading text-lg font-semibold text-ink"><E p="brand.name">{brand.name}</E></a>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          {nav.map((item, i) => (
            <a key={item.href} href={item.href}
              className="text-sm font-medium text-inkSoft transition-colors hover:text-ink">
              <E p={`nav.${i}.label`}>{item.label}</E>
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a href="#cta"
            className="hidden items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accentFg transition-opacity hover:opacity-90 md:inline-flex">
            <E p="hero.cta">{hero.cta}</E>
          </a>
          <a href={brand.phoneHref}
            className="hidden items-center gap-1.5 text-sm font-medium text-ink hover:text-accent md:inline-flex">
            <PhoneCall size={14} weight="bold" className="text-accent" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
          <button type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-rule p-2 text-ink md:hidden">
            {open ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="overflow-hidden border-t border-rule bg-bg md:hidden"
            initial={reduce ? false : { height: 0 }}
            animate={{ height: 'auto' }}
            exit={reduce ? undefined : { height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <nav className="flex flex-col gap-1 px-6 pb-4 pt-3" aria-label="Mobile navigation">
              {nav.map((item, i) => (
                <a key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-inkSoft transition-colors hover:bg-bgSoft hover:text-ink">
                  <E p={`nav.${i}.label`}>{item.label}</E>
                </a>
              ))}
              <a href="#cta" onClick={() => setOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accentFg">
                <E p="hero.cta">{hero.cta}</E>
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
