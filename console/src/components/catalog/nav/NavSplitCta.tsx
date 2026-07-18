'use client';
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { PhoneCall } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { useScrolled } from '@/lib/useScrolled';
import { skinClasses, type SkinId } from '@/lib/skins';
import { stillFor } from '@/lib/motion';

export const meta = {
  id: 'nav-split-cta',
  category: 'nav',
  label: 'Nav / Split CTA',
  consumes: ['nav', 'hero.cta', 'brand.name', 'brand.long', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/useScrolled', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast'],
} as const;

export default function NavSplitCta({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { brand, nav, hero } = content;
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);

  return (
    <header className={`sticky top-0 z-40 ${s.section} backdrop-blur transition-all duration-200 ${scrolled ? `border-b ${s.rule} shadow-sm` : ''}`}>
      <div className={`mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 transition-all duration-300 ${scrolled ? 'py-2.5' : 'py-4'}`}>
        {/* Brand (left) */}
        <a href="#top" className={`font-heading font-bold ${s.heading} transition-all duration-300 ${scrolled ? 'text-base' : 'text-lg'}`}><E p="brand.name">{brand.name}</E></a>

        {/* Nav (center) */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {nav.map((item, i) => (
            <a key={item.label} href={item.href}
              className={`group relative px-3 py-1.5 text-sm font-medium ${s.body} transition-colors hover:text-accent`}>
              <E p={`nav.${i}.label`}>{item.label}</E>
              <span className="absolute inset-x-3 bottom-0 h-px scale-x-0 bg-accent transition-transform group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        {/* Phone + CTA (right) */}
        <div className="flex items-center justify-end gap-3">
          <a href={brand.phoneHref}
            className={`hidden items-center gap-1.5 text-sm font-medium ${s.heading} transition-colors hover:text-accent lg:flex`}>
            <PhoneCall size={15} weight="bold" className="text-accent" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
          <a href="#cta"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accentFg shadow-sm shadow-accent/20 transition-all hover:-translate-y-px hover:opacity-95 active:translate-y-0">
            <E p="hero.cta">{hero.cta}</E>
          </a>

          {/* Burger */}
          <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex flex-col gap-1.5 lg:hidden">
            <span className={`block h-0.5 w-5 ${s.heading === 'text-onInk' ? 'bg-onInk' : 'bg-ink'} transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block h-0.5 w-5 ${s.heading === 'text-onInk' ? 'bg-onInk' : 'bg-ink'} transition-opacity ${open ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 ${s.heading === 'text-onInk' ? 'bg-onInk' : 'bg-ink'} transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className={`overflow-hidden border-t ${s.rule} lg:hidden`}
            initial={still ? false : { height: 0 }}
            animate={{ height: 'auto' }}
            exit={still ? undefined : { height: 0 }}
            transition={{ duration: 0.22 }}>
            <nav className="space-y-1 px-6 pb-5 pt-3">
              {nav.map((item, i) => (
                <a key={item.label} href={item.href} onClick={() => setOpen(false)}
                  className={`block py-2 text-sm font-medium ${s.heading}`}><E p={`nav.${i}.label`}>{item.label}</E></a>
              ))}
              <a href="#cta" onClick={() => setOpen(false)}
                className="mt-3 block rounded-full bg-accent px-4 py-3 text-center text-sm font-semibold text-accentFg">
                <E p="hero.cta">{hero.cta}</E>
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
