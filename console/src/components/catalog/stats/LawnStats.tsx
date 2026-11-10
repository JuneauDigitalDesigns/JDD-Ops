'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnStats — "seasonal / organic / airy" stat slot, premium pass (2026-11-09, approved mockup).
// DUAL (D14, 2026-10-28 resolution): the four white stat tiles became one HAIRLINE LEDGER on the
// soft band — each stat's positional icon in a soft green tile BESIDE the numeral, cells split by
// vertical rules — and beneath it the season rail as a TIMELINE: "Your year with us", a rule with
// a dot per season. Phone: a 2×2 ledger with the icon above the numeral, and a two-column rail
// without the connecting rule.
//
// Both halves are client-supplied and degrade INDEPENDENTLY (D5):
//   about.stats empty    -> the stat ledger is not rendered (D4 — a statistic is never generated)
//   about.seasons absent -> the rail is not rendered (we do not describe a programme the
//                           client doesn't actually run)
// Every colour is a palette token (the icon tile is accent mixed into bg). Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'lawn-stats',
  category: 'stats',
  label: 'Lawn / Stat band + season rail',
  consumes: ['about.stats', 'about.seasons'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/**
 * The mockup's own four hand-picked stat icons (truck/clock/star/pin), indexed positionally.
 * Purely decorative chrome: Stat has no `icon` field (HvacStatBand has no icons at all either),
 * so there is nothing schema-driven to pick from — these are NOT wrapped in <Ico>, which exists
 * to let the studio override a schema-driven icon choice that doesn't exist here.
 */
const STAT_ICONS = [
  <svg key="0" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"><path d="M3 18h12a4 4 0 004-4V8" /><circle cx="6" cy="18" r="3" /></svg>,
  <svg key="1" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>,
  <svg key="2" width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.8-5 4.7 1.3 6.8L12 17.4 5.9 20.6 7.2 13.8l-5-4.7 6.9-.8z" /></svg>,
  <svg key="3" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"><path d="M12 21s-7-4.5-7-9.5A7 7 0 0119 11.5c0 5-7 9.5-7 9.5z" /><circle cx="12" cy="11" r="2.4" /></svg>,
];

export default function LawnStats({ content = CONTENT }: { content?: SiteContent }) {
  const stats = (content.about.stats ?? []).filter((s) => s.n?.trim());
  const seasons = (content.about.seasons ?? []).filter((s) => s.body?.trim());
  if (!stats.length && !seasons.length) return null;

  return (
    <section className="bg-bgSoft py-12 lg:py-16">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        {stats.length > 0 && (
          <div className="grid grid-cols-2 border-y border-rule lg:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.l || i}
                className={`flex min-w-0 flex-col gap-2.5 px-4 py-[18px] lg:flex-row lg:items-start lg:gap-4 lg:px-7 lg:py-[26px] ${
                  i % 2 === 0 ? 'pl-0' : 'border-l border-rule'
                } ${i >= 2 ? 'border-t border-rule' : ''} lg:border-t-0 ${i > 0 ? 'lg:border-l lg:border-rule lg:pl-7' : 'lg:pl-0'}`}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-accent"
                  style={{ background: 'color-mix(in srgb, var(--accent) 12%, var(--bg))' }}
                  aria-hidden="true"
                >
                  {STAT_ICONS[i % STAT_ICONS.length]}
                </span>
                <div className="min-w-0">
                  <div className="font-heading text-[38px] font-extrabold leading-none tracking-[-0.02em] text-ink lg:text-[44px]">
                    <E p={`about.stats.${i}.n`}>{s.n}</E>
                  </div>
                  <div className="mt-1.5 text-[13.5px] font-semibold leading-[1.35] text-inkSoft">
                    <E p={`about.stats.${i}.l`}>{s.l}</E>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {seasons.length > 0 && (
          <div className={stats.length ? 'mt-[34px] border-t border-rule pt-7' : ''}>
            <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              Your year with us
            </div>
            <div className="relative mt-[18px] grid grid-cols-2 gap-5 md:grid-cols-4">
              {/* The timeline's rule: one hairline the season dots sit on (desktop only). */}
              <span className="absolute left-0 right-0 top-1 hidden h-px bg-rule md:block" aria-hidden="true" />
              {seasons.map((s, i) => (
                <div key={s.key} className="relative min-w-0 pt-[22px]">
                  <span
                    className="absolute left-0 top-0 h-[9px] w-[9px] rounded-full bg-accent"
                    style={{ boxShadow: '0 0 0 4px var(--bg-soft)' }}
                    aria-hidden="true"
                  />
                  <div className="text-[11.5px] font-extrabold uppercase leading-none tracking-[0.15em] text-accent">
                    <E p={`about.seasons.${i}.label`}>{s.label}</E>
                  </div>
                  <div className="mt-1.5 text-[14px] leading-[1.5] text-inkSoft">
                    <E p={`about.seasons.${i}.body`}>{s.body}</E>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
