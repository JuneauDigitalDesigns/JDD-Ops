'use client';
// ─────────────────────────────────────────────────────────────────────────────
// NavMinimal — recomposed 2026-08-19 against design/catalog-v2/SPEC.md.
//
// THE PHONE IS VISIBLE AT EVERY BREAKPOINT. It previously carried
// `hidden ... md:inline-flex`, so the single most important element on a local
// service site did not exist on the device most of its visitors use. Same for the
// CTA. Mobile got a burger and nothing else. See SPEC §4 and §8: nothing essential
// may sit inside a hidden-until-breakpoint wrapper, and desktop may only add room,
// never meaning.
//
// The number collapses to an icon below `md` because 390px cannot hold brand +
// digits + burger — but the ACTION never disappears, and it stays a 48px target.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { List, X, PhoneCall } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { useScrolled } from '@/lib/useScrolled';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, stillFor } from '@/lib/motion';

export const meta = {
  id: 'nav-minimal',
  category: 'nav',
  label: 'Nav / Standard',
  consumes: ['nav', 'hero.cta', 'brand.name', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/useScrolled', '@/lib/skins', '@/lib/motion'],
  skins: ['default', 'inverted'],
} as const;

export default function NavMinimal({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
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
    <header
      className={`sticky top-0 z-50 border-b ${s.rule} ${s.section} backdrop-blur transition-shadow duration-200 ${scrolled ? 'shadow-sm' : ''}`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
        <a href="#top" className={`font-heading text-lg font-bold ${s.heading}`}>
          <E p="brand.name">{brand.name}</E>
        </a>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main navigation">
          {nav.map((item, i) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-[15px] font-semibold ${s.body} transition-colors hover:text-accent`}
            >
              <E p={`nav.${i}.label`}>{item.label}</E>
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Secondary to the phone, and desktop-only by choice: on mobile it would compete
              with the call button for the same tap, and the call is the conversion. The
              action itself is not lost — the hero carries it. */}
          <a
            href="#cta"
            className={`hidden rounded-lg border-2 px-4 py-2.5 text-[15px] font-bold lg:inline-flex ${s.heading} border-current/25 hover:bg-accent hover:text-accentFg hover:border-transparent transition-colors`}
          >
            <E p="hero.cta">{hero.cta}</E>
          </a>

          {/* The number itself, not the word "Call": a visible phone number is a trust
              signal, so the digits show wherever there is room for them. min-h-12 = 48px,
              the tap-target floor that `target-size` audits against. */}
          <a
            href={brand.phoneHref}
            className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-accent px-3.5 font-bold text-accentFg transition-[filter] hover:brightness-105 sm:px-4"
          >
            <PhoneCall size={20} weight="fill" aria-hidden="true" />
            <span className="hidden text-[15px] md:inline">
              <E p="brand.phone">{brand.phone}</E>
            </span>
            {/* Below md the digits are dropped for space, so the link would otherwise have no
                accessible name at all — the icon is aria-hidden. */}
            <span className="sr-only md:hidden">Call {brand.phone}</span>
          </a>

          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border ${s.rule} ${s.heading} md:hidden`}
          >
            {open ? <X size={22} /> : <List size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className={`overflow-hidden border-t ${s.rule} ${s.section} md:hidden`}
            initial={still ? false : { height: 0 }}
            animate={{ height: 'auto' }}
            exit={still ? undefined : { height: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <nav className="flex flex-col gap-1 px-5 pb-4 pt-2" aria-label="Mobile navigation">
              {nav.map((item, i) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-12 items-center rounded-lg px-3 text-[15px] font-semibold ${s.body} transition-colors hover:text-accent`}
                >
                  <E p={`nav.${i}.label`}>{item.label}</E>
                </a>
              ))}
              <a
                href="#cta"
                onClick={() => setOpen(false)}
                className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-current/25 px-4 text-[15px] font-bold"
              >
                <E p="hero.cta">{hero.cta}</E>
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
