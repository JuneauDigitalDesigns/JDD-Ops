'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HeroFormFocus — recomposed 2026-08-19 against design/catalog-v2/SPEC.md.
//
// The form-led hero, for clients who want lead capture above the fold. HeroSplit
// is the image-led default; this one trades the photograph for the form.
//
// NO ON-LOAD MOTION. Everything here is above the fold (SPEC §9). On HeroSplit
// the same entrance animation put 84% of a 4.2s LCP into Render Delay on a plain
// text node, so framer-motion is not imported here either.
//
// Its own useState/fetch form is gone in favour of <LeadForm>, which is where
// labels, validation, aria-invalid and the error state actually live. The old
// copy had placeholder-only inputs and set an error status it never rendered —
// a failed POST showed the visitor nothing at all.
//
// Adapts to plan via `_meta.selectedPlan`, so it serves starter and growth from
// one file and declares no fixed `leadMode`.
// ─────────────────────────────────────────────────────────────────────────────
import { CheckCircle, PhoneCall } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'hero-form',
  category: 'hero',
  label: 'Hero / Lead form',
  consumes: [
    'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.formLabel', 'hero.cta',
    'hero.frictionReducers', 'brand.phone', 'brand.phoneHref',
  ],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins', '@/lib/LeadForm'],
  skins: ['default', 'soft'],
} as const;

function Headline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const idx = text.indexOf(emphasis);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent">{emphasis}</span>
      {text.slice(idx + emphasis.length)}
    </>
  );
}

export default function HeroFormFocus({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const dark = skin === 'inverted' || skin === 'contrast';
  const { hero, brand } = content;
  const mode = content._meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <section id="top" className={`${s.section} py-10 lg:py-16`}>
      <div className="mx-auto grid max-w-6xl gap-9 px-5 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:gap-14">
        <div>
          <h1 className={`font-heading text-[34px] font-extrabold leading-[1.05] tracking-[-0.015em] sm:text-[42px] lg:text-[54px] ${s.heading}`}>
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>
          <p className={`mt-4 max-w-[46ch] text-[17px] leading-relaxed sm:text-[18px] ${s.body}`}>
            <E p="hero.sub">{hero.sub}</E>
          </p>

          {/* Even on the form-led hero the number stays reachable — someone with a broken
              furnace should never have to fill in a form to reach a person (SPEC §4). */}
          <a
            href={brand.phoneHref}
            className="mt-6 inline-flex items-center gap-2.5 rounded-lg bg-accent px-5 py-3.5 text-accentFg transition-[filter] hover:brightness-105"
          >
            <PhoneCall size={21} weight="fill" aria-hidden="true" />
            <span className="whitespace-nowrap text-[21px] font-extrabold tracking-[-0.02em]">
              <E p="brand.phone">{brand.phone}</E>
            </span>
          </a>

          {hero.frictionReducers.length > 0 && (
            <ul className={`mt-7 grid max-w-[520px] grid-cols-2 gap-x-4 gap-y-3 border-t pt-5 ${s.rule}`}>
              {hero.frictionReducers.map((f, i) => (
                <li key={f} className="flex items-start gap-2 text-[15px] font-semibold leading-snug">
                  <CheckCircle size={19} weight="fill" className="mt-px shrink-0 text-accent" aria-hidden="true" />
                  <E p={`hero.frictionReducers.${i}`}>{f}</E>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className={`rounded-xl border p-6 lg:p-7 ${
            dark
              ? 'border-ruleInk bg-inkPanel2'
              : 'border-rule/70 bg-bgSoft shadow-[0_1px_2px_rgba(28,16,9,.05),0_16px_34px_-14px_rgba(28,16,9,.24)]'
          }`}
        >
          <p className={`text-[20px] font-extrabold leading-snug ${s.heading}`}>
            <E p="hero.formLabel">{hero.formLabel}</E>
          </p>
          <LeadForm
            mode={mode}
            surface={dark ? 'dark' : 'light'}
            className="mt-4"
            submitLabel={<E p="hero.cta">{hero.cta}</E>}
          />
        </div>
      </div>
    </section>
  );
}
