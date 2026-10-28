'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnHero — "seasonal / organic / airy" hero, mirrored 1:1 (design: home-mockups.html #lawn
// .hero / .picker). A warm forest-tinted scrim under a full-bleed photo, with a plan PICKER
// (weekly/bi-weekly/one-time) replacing every other vertical's urgency line — the only hero in
// the set that quotes a price. Real client-side state (useState), not static chrome: the
// visitor's selection changes which option is highlighted and which frequency the "See my
// price" link carries through to the contact form (D8).
//
// "See my price" routes to /contact?frequency=<selection> — a WHITELISTED set of known values,
// never the raw param echoed. The contact page (LawnContact's caller, the composed page) maps
// that param to a fixed string and seeds <LeadForm initialMessage>, so the field stays fully
// editable and nothing user-controlled reaches an owner email unvalidated.
//
// The price anchor reads services.items[0]?.priceFrom (the primary/weekly service) rather than
// inventing a standalone hero price field — absent → the price line is simply omitted (D5).
// Content stays schema-driven. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'lawn-hero',
  category: 'hero',
  label: 'Lawn / Plan-picker hero',
  consumes: [
    'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'extensions.reviewBadge',
    'services.items', 'images.hero.slides',
  ],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

const FREQUENCIES = [
  { key: 'weekly', label: 'Weekly', sub: 'Mar–Oct' },
  { key: 'biweekly', label: 'Bi-weekly', sub: 'Year-round' },
  { key: 'onetime', label: 'One-time', sub: 'Cleanup' },
] as const;

function Headline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const i = text.indexOf(emphasis);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-[#E8B33A]">{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export default function LawnHero({ content = CONTENT }: { content?: SiteContent }) {
  const { hero, extensions, services, images } = content;
  const [selected, setSelected] = useState<(typeof FREQUENCIES)[number]['key']>('weekly');
  const slide = images.hero?.slides?.[0]?.url ?? images.hero?.portrait;
  const review = extensions.reviewBadge;
  const priceFrom = services.items.find((it) => it.priceFrom)?.priceFrom;

  return (
    <section className="relative isolate flex min-h-[620px] items-center overflow-hidden bg-[#1E4028]">
      {slide && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${slide})` }}
          role="img"
          aria-label={images.hero?.slides?.[0]?.alt ?? `${content.brand.name} lawn`}
        />
      )}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(95deg,rgba(14,38,20,.88) 0%,rgba(14,38,20,.58) 46%,rgba(14,38,20,.14) 100%),' +
            'linear-gradient(180deg,rgba(14,38,20,.1),rgba(14,38,20,.45))',
        }}
      />

      <div className="relative mx-auto w-full max-w-[1140px] px-6 py-[92px]">
        <div className="max-w-[620px] text-[#fff]">
          {review && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(232,179,58,0.42)] bg-[rgba(232,179,58,0.18)] px-[15px] py-[7px] text-[13px] font-bold text-[#E8B33A]">
              ★ {review.rating} from {review.count}+ neighbours
            </span>
          )}

          <h1 className="mt-[18px] font-heading text-[clamp(40px,5.2vw,60px)] font-extrabold leading-[1.04] text-[#fff]">
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>

          <p className="mt-4 max-w-[46ch] text-[18.5px] leading-[1.62] text-[#D3E0D2]">
            <E p="hero.sub">{hero.sub}</E>
          </p>

          {/* The plan picker — lawn care's signature hero device (D8). Real state, not chrome. */}
          <div className="mt-7 max-w-[520px] rounded-[20px] border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.1)] p-[18px] backdrop-blur-md">
            <div className="text-[12px] font-bold uppercase tracking-[0.13em] text-[#B9CDBA]">How often?</div>
            <div className="mt-[11px] grid grid-cols-3 gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setSelected(f.key)}
                  aria-pressed={selected === f.key}
                  className={`rounded-[13px] border-[1.5px] px-2 py-3 text-center text-[14px] font-bold transition-colors ${
                    selected === f.key
                      ? 'border-[#fff] bg-[#fff] text-[#1E4028]'
                      : 'border-[rgba(255,255,255,0.22)] text-[#E3EDE2]'
                  }`}
                >
                  {f.label}
                  <small
                    className="mt-[3px] block text-[11.5px] font-semibold"
                    style={{ color: selected === f.key ? '#5B6F62' : '#B9CDBA' }}
                  >
                    {f.sub}
                  </small>
                </button>
              ))}
            </div>
            <div className="mt-[15px] flex items-center justify-between gap-3.5 border-t border-[rgba(255,255,255,0.18)] pt-[14px]">
              {priceFrom ? (
                <div className="font-heading text-[17px] font-extrabold tracking-[-0.015em] text-[#fff]">
                  <E p="services.items.0.priceFrom">{priceFrom}</E>{' '}
                  <small className="font-semibold text-[12.5px] text-[#B9CDBA]">/ visit</small>
                </div>
              ) : (
                <span />
              )}
              <a
                href={`/contact?frequency=${selected}`}
                className="inline-flex items-center rounded-[14px] bg-accent px-[18px] py-[11px] text-[14.5px] font-extrabold text-accentFg shadow-[0_10px_22px_-9px_rgba(47,122,51,0.5)]"
              >
                See my price →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
