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
  skins: ['contrast', 'editorial'],
} as const;

export default function NavEmergencyBar({
  content = CONTENT,
  skin = 'contrast',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const { brand, announcement } = content;
  const msg = announcement ?? '24/7 emergency service — we answer day or night.';
  return (
    <header>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-accent px-6 py-2.5 text-center text-sm font-medium text-accentFg">
        <span className="inline-flex items-center gap-1.5"><Warning size={16} weight="fill" /><E p="announcement">{msg}</E></span>
        <a href={brand.phoneHref} className="inline-flex items-center gap-1.5 rounded-full bg-bg/15 px-3 py-0.5 hover:bg-bg/25">
          <Phone size={14} weight="fill" /><E p="brand.phone">{brand.phone}</E>
        </a>
      </div>
      <nav className={`flex items-center justify-between border-b ${s.rule} ${s.section} px-6 py-4`}>
        <span className={`font-heading text-lg font-bold ${s.heading}`}><E p="brand.name">{brand.name}</E></span>
        <a href="#cta" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accentFg transition-transform hover:-translate-y-0.5">Book now</a>
      </nav>
    </header>
  );
}
