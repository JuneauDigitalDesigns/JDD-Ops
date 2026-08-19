'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FinalCtaBanner — recomposed 2026-08-19 against design/catalog-v2/SPEC.md.
//
// SERVES BOTH PLANS FROM ONE FILE. It reads `_meta.selectedPlan` and hands the
// mode to <LeadForm>: starter captures an email (Resend mails the owner),
// growth/enterprise captures a phone number (the Retell agent calls the lead
// back). This is what made the seven `*Starter` duplicate components deletable,
// and it is why `meta` no longer declares a `leadMode` — this component has no
// fixed one. See categories.tsx `forPlan`, which now treats an absent leadMode as
// "adapts to either".
//
// The phone is the primary action and the form is the alternative, not the other
// way round (SPEC §4). Previously this section led with a bare name/phone bar and
// the number appeared nowhere in it.
//
// Removed: the wide-tracked uppercase eyebrow, the 60px masthead headline, the
// two radial accent washes and the `rounded-sm` offset-shadow button. Sections
// are separated by mass now, not by decoration.
// ─────────────────────────────────────────────────────────────────────────────
import { PhoneCall, CheckCircle } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

export const meta = {
  id: 'finalcta-banner',
  category: 'finalCta',
  label: 'Final CTA / Banner',
  consumes: [
    'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers',
    'brand.phone', 'brand.phoneHref',
  ],
  sharedDeps: ['@phosphor-icons/react', '@/lib/LeadForm'],
} as const;

export default function FinalCtaBanner({ content = CONTENT }: { content?: SiteContent }) {
  const { finalCta, brand } = content;
  const mode = content._meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <section id="cta" className="bg-inkPanel text-onInk">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div>
          <h2 className="font-heading text-[30px] font-extrabold leading-[1.05] tracking-[-0.015em] sm:text-[36px] lg:text-[42px]">
            <E p="finalCta.headline">{finalCta.headline}</E>
          </h2>
          <p className="mt-4 max-w-[48ch] text-[17px] leading-relaxed text-onInkSoft sm:text-[18px]">
            <E p="finalCta.sub">{finalCta.sub}</E>
          </p>

          {/* Primary action. The digits are the point — a visible number is itself a
              reassurance, and for an urgent repair the call converts, not the form. */}
          <a
            href={brand.phoneHref}
            className="mt-7 inline-flex items-center gap-3 rounded-lg bg-accent px-6 py-4 text-accentFg transition-[filter] hover:brightness-105"
          >
            <PhoneCall size={24} weight="fill" aria-hidden="true" />
            <span className="whitespace-nowrap text-[23px] font-extrabold tracking-[-0.02em]">
              <E p="brand.phone">{brand.phone}</E>
            </span>
          </a>

          {finalCta.frictionReducers.length > 0 && (
            <ul className="mt-7 grid gap-2.5 border-t border-ruleInk pt-6 sm:grid-cols-2">
              {finalCta.frictionReducers.map((r, i) => (
                <li key={r} className="flex items-start gap-2 text-[15px] font-semibold leading-snug">
                  <CheckCircle size={18} weight="fill" className="mt-px shrink-0 text-accent" aria-hidden="true" />
                  <E p={`finalCta.frictionReducers.${i}`}>{r}</E>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* The alternative path, for anyone who would rather not call. */}
        <div className="mt-10 rounded-xl bg-white/[0.07] p-6 lg:mt-0 lg:p-8">
          <p className="text-[19px] font-extrabold">
            {mode === 'email' ? 'Or send us a message' : 'Or have us call you back'}
          </p>
          <p className="mt-1.5 text-[15px] text-onInkSoft">
            {mode === 'email'
              ? 'Tell us what you need and we will reply by email.'
              : 'Leave a number and we will ring you straight back.'}
          </p>
          <LeadForm
            mode={mode}
            surface="dark"
            withMessage
            className="mt-5"
            submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>}
          />
        </div>
      </div>
    </section>
  );
}
