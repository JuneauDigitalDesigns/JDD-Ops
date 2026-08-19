'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FaqStickyAside — recomposed 2026-08-19 against design/catalog-v2/SPEC.md.
//
// A11Y FIX, not just a restyle. The question buttons carried `aria-expanded` but
// nothing tied them to the pane they control, so a screen reader was told a
// control was expanded with no way to reach what it expanded. They now carry
// `aria-controls` pointing at the answer region, and the region is labelled by
// the active question.
//
// Deliberately NOT role="tablist". That pattern obliges arrow-key navigation
// between tabs, and claiming the role without implementing the keyboard contract
// is worse than plain buttons that behave exactly as they appear.
//
// Removed: the uppercase tracked eyebrow, and the AnimatePresence swap on the
// answer pane — a 300ms fade between two paragraphs was the only thing in this
// file needing framer-motion.
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useState } from 'react';
import { CaretRight, PhoneCall } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'faq-two-pane',
  category: 'faq',
  label: 'FAQ / Two-pane',
  consumes: ['faq.title', 'faq.sub', 'faq.items', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins'],
  skins: ['soft', 'default'],
} as const;

export default function FaqStickyAside({
  content = CONTENT,
  skin = 'soft',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const uid = useId();
  const s = skinClasses(skin);
  const dark = skin === 'inverted' || skin === 'contrast';
  const { faq, brand } = content;
  const [active, setActive] = useState(0);
  if (!faq.items.length) return null;
  const current = faq.items[active];
  const panelId = `${uid}-answer`;

  return (
    <section id="faq" className={`${s.section} py-14 lg:py-20`}>
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <div className="max-w-[46ch]">
          <h2 className={`font-heading text-[28px] font-extrabold leading-[1.05] tracking-[-0.015em] sm:text-[34px] ${s.heading}`}>
            <E p="faq.title">{faq.title}</E>
          </h2>
          <p className={`mt-3.5 text-[17px] leading-relaxed ${s.body}`}>
            <E p="faq.sub">{faq.sub}</E>
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.15fr] lg:items-start">
          <ul className="space-y-1.5">
            {faq.items.map((f, i) => (
              <li key={i}>
                <button
                  type="button"
                  id={`${uid}-q${i}`}
                  onClick={() => setActive(i)}
                  aria-expanded={active === i}
                  aria-controls={panelId}
                  className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left text-[15.5px] font-bold transition-colors ${
                    i === active
                      ? dark ? 'bg-inkPanel2 text-onInk' : 'bg-bg text-ink shadow-[0_1px_2px_rgba(28,16,9,.06)]'
                      : `${s.body} ${dark ? 'hover:bg-white/5' : 'hover:bg-bg/60'}`
                  }`}
                >
                  <span><E p={`faq.items.${i}.q`}>{f.q}</E></span>
                  <CaretRight
                    size={17}
                    weight="bold"
                    aria-hidden="true"
                    className={`shrink-0 ${i === active ? 'text-accent' : 'opacity-40'}`}
                  />
                </button>
              </li>
            ))}
          </ul>

          <div
            id={panelId}
            role="region"
            aria-labelledby={`${uid}-q${active}`}
            className={`rounded-xl border p-6 lg:sticky lg:top-24 lg:p-7 ${
              dark ? 'border-ruleInk bg-inkPanel2' : 'border-rule/70 bg-bg shadow-[0_1px_2px_rgba(28,16,9,.05),0_12px_26px_-14px_rgba(28,16,9,.2)]'
            }`}
          >
            <h3 className={`font-heading text-[20px] font-extrabold leading-snug ${s.heading}`}>
              <E p={`faq.items.${active}.q`}>{current.q}</E>
            </h3>
            <p className={`mt-3 text-[16px] leading-relaxed ${s.body}`}>
              <E p={`faq.items.${active}.a`}>{current.a}</E>
            </p>
            <a
              href={brand.phoneHref}
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-[16px] font-extrabold text-accent hover:underline"
            >
              <PhoneCall size={18} weight="fill" aria-hidden="true" />
              Still unsure? Call <E p="brand.phone">{brand.phone}</E>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
