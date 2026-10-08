'use client';
import { Phone, Warning } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'nav-emergency-bar',
  category: 'nav',
  label: 'Nav / Emergency 24-7 Bar',
  consumes: ['announcement', 'brand.phone', 'brand.phoneHref', 'brand.name', 'nav'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins'],
  skins: ['inverted', 'default'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'stacked-bars',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
} as const;

export default function NavEmergencyBar({
  content = CONTENT,
  skin = 'inverted',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const { brand, announcement, nav } = content;
  const msg = announcement ?? '24/7 emergency service. We answer day or night.';
  // Render the page links whenever this is a multi-page site (more than the lone home link that
  // navLinksFor emits for a single-page composition). This is what lets a 4+ page client reach
  // Services/About/Contact from the Emergency-bar nav; a single-page site keeps the lean
  // brand + CTA bar unchanged. The links wrap below the brand/CTA at narrow widths (this variant
  // has no burger menu), so they stay reachable at 390px. See plan section 9e.
  const showLinks = nav.length > 1;
  return (
    <header>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-accent px-6 py-2.5 text-center text-sm font-medium text-accentFg">
        <span className="inline-flex items-center gap-1.5"><Warning size={16} weight="fill" /><E p="announcement">{msg}</E></span>
        <a href={brand.phoneHref} className="inline-flex items-center gap-1.5 rounded-full bg-bg/15 px-3 py-0.5 hover:bg-bg/25">
          <Phone size={14} weight="fill" /><E p="brand.phone">{brand.phone}</E>
        </a>
      </div>
      <nav className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b ${s.rule} ${s.section} px-6 py-4`} aria-label="Main navigation">
        <span className={`font-heading text-lg font-bold ${s.heading}`}><E p="brand.name">{brand.name}</E></span>
        {showLinks && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {nav.map((item, i) => (
              <a
                key={item.href}
                href={item.href}
                className={`text-[15px] font-semibold ${s.body} transition-colors hover:text-accent`}
              >
                <E p={`nav.${i}.label`}>{item.label}</E>
              </a>
            ))}
          </div>
        )}
        <a href="#cta" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accentFg transition-transform hover:-translate-y-0.5">Book now</a>
      </nav>
    </header>
  );
}
