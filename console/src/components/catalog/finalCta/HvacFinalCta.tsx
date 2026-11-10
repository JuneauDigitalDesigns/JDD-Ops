'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacFinalCta — Northstar "Home — Standard" final CTA, premium pass (2026-11-09, approved mockup).
// The signature navy band (ink-panel with a steel radial glow) with the pitch on the left and a
// white lead-CAPTURE card on the right. The form is the shared <LeadForm>, so it POSTs {name,
// phone|email} to /api/contact exactly as onboard.js's provisioned contact route expects —
// provisioning keeps working on the exported client site. New: extensions.trustBadges render as a
// hairline seal row under the form (real intake data only; hidden when empty). The headline's
// emphasis word is the brand ACCENT (editable). Reads finalCta.* + brand phone.
// Every colour is a palette token.
// ─────────────────────────────────────────────────────────────────────────────
import { CheckCircle, ShieldCheck } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

/** Headline with an optional accent emphasis phrase, matching `.cta-grid h2 .em`. */
function CtaHeadline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const i = text.indexOf(emphasis);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-accent">{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export const meta = {
  id: 'hvac-final-cta',
  category: 'finalCta',
  label: 'HVAC / Final CTA',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers', 'extensions.trustBadges'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function HvacFinalCta({ content = CONTENT }: { content?: SiteContent }) {
  const { finalCta, extensions, _meta } = content;
  // Lead mode follows the plan, same as the hero/<LeadForm> pattern: starter captures by email,
  // growth/enterprise by phone callback. The provisioned /api/contact route honors the matching
  // LEAD_DELIVERY_MODE, so the posted field (email vs phone) lines up with delivery.
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const badges = (extensions.trustBadges ?? []).filter((b) => b?.trim());

  return (
    <section
      id="cta"
      className="relative isolate overflow-hidden bg-inkPanel py-16 text-onInk lg:py-[104px]"
      style={{
        background:
          'radial-gradient(1100px 380px at 85% -10%, color-mix(in srgb, var(--accent-2-strong) 14%, transparent), transparent 60%),' +
          'linear-gradient(180deg, var(--ink-panel-2), var(--ink-panel))',
      }}
    >
      <div className="mx-auto grid max-w-[1120px] items-center gap-10 px-5 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <div>
          {finalCta.eyebrow && (
            <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2-strong)]">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3.5 font-heading text-[clamp(32px,3.8vw,48px)] font-semibold leading-[1.02] text-onInk">
            <CtaHeadline text={finalCta.headline} emphasis={finalCta.headlineEmphasis} />
          </h2>
          <p className="mt-3.5 max-w-[46ch] text-[17px] leading-[1.65] text-onInkSoft">
            <E p="finalCta.sub">{finalCta.sub}</E>
          </p>
          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-x-[22px] gap-y-[10px]">
              {finalCta.frictionReducers.map((f, i) => (
                <span key={f} className="flex items-center gap-2 text-[14.5px] font-semibold text-onInk">
                  <CheckCircle size={18} weight="fill" className="text-[color:var(--star)]" aria-hidden="true" />
                  <E p={`finalCta.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* White capture card — the shared LeadForm owns the POST to /api/contact. */}
        <div className="shadow-brand-3 rounded-[18px] bg-bg p-6 text-ink sm:p-7">
          <h3 className="font-heading text-[22px] font-semibold text-ink">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h3>
          <p className="mt-1.5 text-[14px] text-inkSoft">Tell us what&rsquo;s going on — we&rsquo;ll call you right back.</p>
          <LeadForm
            mode={mode}
            surface="light"
            className="mt-3.5"
            submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>}
          />
          {badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-3.5 gap-y-1.5 border-t border-rule pt-3.5">
              {badges.map((b, i) => (
                <span key={b} className="flex items-center gap-1.5 text-[12px] font-semibold text-inkSoft">
                  <ShieldCheck size={13} weight="fill" className="text-[color:var(--accent-2)]" aria-hidden="true" />
                  <E p={`extensions.trustBadges.${i}`}>{b}</E>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
