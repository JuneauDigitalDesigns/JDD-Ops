'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ContactInlineStrip — recomposed 2026-08-19 against design/catalog-v2/SPEC.md.
//
// A compact mid-page capture bar: one line of intent, the phone number as the
// primary action, and a two-field form as the alternative. It is deliberately
// lighter than FinalCtaBanner — this one interrupts, that one closes.
//
// Adapts to plan via `_meta.selectedPlan`, so `meta` declares no fixed `leadMode`
// (see the note on `forPlan` in build/categories.tsx). Its own useState/fetch
// form is gone: labels, validation, aria-invalid and — critically — the error
// state that the old copy set but never rendered all live in <LeadForm> now.
//
// The `border-y` hairlines that used to define this strip are replaced by the
// soft surface. Sections are separated by mass, not lines (SPEC §1).
// ─────────────────────────────────────────────────────────────────────────────
import { PhoneCall } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'contact-inline-strip',
  category: 'contact',
  label: 'Contact / Inline strip',
  consumes: ['finalCta.cta', 'finalCta.sub', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins', '@/lib/LeadForm'],
  skins: ['default', 'inverted'],
} as const;

export default function ContactInlineStrip({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const dark = skin === 'inverted' || skin === 'contrast';
  const { finalCta, brand } = content;
  const mode = content._meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <section id="contact" className={`${s.section} py-12 lg:py-14`}>
      <div className="mx-auto grid max-w-6xl gap-7 px-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12">
        <div>
          <p className={`font-heading text-[24px] font-extrabold leading-tight tracking-[-0.015em] sm:text-[28px] ${s.heading}`}>
            {mode === 'email' ? 'Need a hand? Send us a note.' : 'Need a hand? We can call you back.'}
          </p>
          <p className={`mt-2 max-w-[44ch] text-[16px] ${s.body}`}>
            <E p="finalCta.sub">{finalCta.sub}</E>
          </p>

          <a
            href={brand.phoneHref}
            className="mt-5 inline-flex items-center gap-2.5 rounded-lg bg-accent px-5 py-3 text-accentFg transition-[filter] hover:brightness-105"
          >
            <PhoneCall size={20} weight="fill" aria-hidden="true" />
            <span className="whitespace-nowrap text-[19px] font-extrabold tracking-[-0.01em]">
              <E p="brand.phone">{brand.phone}</E>
            </span>
          </a>
        </div>

        <LeadForm
          mode={mode}
          surface={dark ? 'dark' : 'light'}
          layout="row"
          submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>}
        />
      </div>
    </section>
  );
}
