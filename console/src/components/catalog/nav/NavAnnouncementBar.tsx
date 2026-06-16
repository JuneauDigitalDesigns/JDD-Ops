'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { useScrolled } from '@/lib/useScrolled';

export const meta = {
  id: 'nav-announcement',
  category: 'nav',
  label: 'Nav / Announcement bar',
  consumes: ['nav', 'hero.cta', 'announcement', 'brand.name', 'brand.long', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/useScrolled'],
} as const;

export default function NavAnnouncementBar({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { brand, nav, hero, announcement } = content;
  const [barVisible, setBarVisible] = useState(true);
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open]);

  return (
    <>
      {/* Announcement strip */}
      <AnimatePresence>
        {announcement && barVisible && (
          <motion.div
            className="flex items-center justify-between gap-2 bg-accent px-4 py-2 text-sm text-accentFg"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <span className="mx-auto"><E p="announcement">{announcement}</E></span>
            <button type="button" onClick={() => setBarVisible(false)} aria-label="Dismiss"
              className="shrink-0 rounded p-0.5 text-accentFg/70 hover:text-accentFg">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky nav */}
      <header className={`sticky top-0 z-40 border-b border-rule bg-bg/95 backdrop-blur transition-shadow duration-200 ${scrolled ? 'shadow-sm' : ''}`}>
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <a href="#top" className="mr-auto font-heading text-lg font-semibold text-ink">
            <E p="brand.long">{brand.long}</E>
          </a>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
            {nav.map((item, i) => (
              <a key={item.label} href={item.href}
                className="text-sm font-medium text-inkSoft transition-colors hover:text-ink">
                <E p={`nav.${i}.label`}>{item.label}</E>
              </a>
            ))}
          </nav>

          <a href={brand.phoneHref}
            className="hidden text-sm font-medium text-ink transition-colors hover:text-accent lg:block">
            <E p="brand.phone">{brand.phone}</E>
          </a>
          <a href="#cta"
            className="hidden rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accentFg transition-opacity hover:opacity-90 lg:inline-block">
            <E p="hero.cta">{hero.cta}</E>
          </a>

          {/* Mobile burger */}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 lg:hidden">
            <span className={`block h-0.5 w-5 bg-ink transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-5 bg-ink transition-opacity ${open ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 bg-ink transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>

        {/* Mobile sheet */}
        <AnimatePresence>
          {open && (
            <motion.div
              className="overflow-hidden lg:hidden"
              initial={reduce ? false : { height: 0 }}
              animate={{ height: 'auto' }}
              exit={reduce ? undefined : { height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <nav className="border-t border-rule px-6 pb-6 pt-4 space-y-1">
                {nav.map((item, i) => (
                  <a key={item.label} href={item.href} onClick={() => setOpen(false)}
                    className="block py-2.5 text-sm font-medium text-ink">
                    <E p={`nav.${i}.label`}>{item.label}</E>
                  </a>
                ))}
                <a href="#cta" onClick={() => setOpen(false)}
                  className="mt-4 block rounded-lg bg-accent px-4 py-3 text-center text-sm font-semibold text-accentFg">
                  <E p="hero.cta">{hero.cta}</E>
                </a>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
