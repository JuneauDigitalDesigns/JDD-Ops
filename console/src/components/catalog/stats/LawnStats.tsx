'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnStats — "seasonal / organic / airy" stat slot, mirrored 1:1 (#lawn .statband / .srail).
// DUAL (D14, 2026-10-28 resolution): a conventional four-tile trust band (icon ABOVE the
// numeral — HVAC's steel top-notch, roofing's dark ledger, detailing's hairline strip are each
// vertical's own treatment of the same under-hero slot), plus a slim season-rail timeline
// beneath it — demoted from an earlier four-card treatment that was too loud for this slot.
//
// Both halves are client-supplied and degrade INDEPENDENTLY (D5):
//   about.stats empty    -> the stat band is not rendered (D4 — a statistic is never generated)
//   about.seasons absent -> the rail is not rendered (we do not describe a programme the
//                           client doesn't actually run)
// Fixed design, no skin.
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
    <section className="bg-bgSoft py-[56px]">
      <div className="mx-auto max-w-[1140px] px-6">
        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-[22px] lg:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.l || i}
                className="rounded-[22px] border border-rule bg-bg px-[22px] py-6 shadow-[0_1px_2px_rgba(22,37,26,0.04)]"
              >
                <span
                  className="mb-3.5 grid h-[38px] w-[38px] place-items-center rounded-[12px] text-accent"
                  style={{ background: '#E2EDDB' }}
                  aria-hidden="true"
                >
                  {STAT_ICONS[i % STAT_ICONS.length]}
                </span>
                <div className="font-heading text-[40px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                  <E p={`about.stats.${i}.n`}>{s.n}</E>
                </div>
                <div className="mt-[7px] text-[13.5px] font-semibold leading-[1.35] text-inkSoft">
                  <E p={`about.stats.${i}.l`}>{s.l}</E>
                </div>
              </div>
            ))}
          </div>
        )}

        {seasons.length > 0 && (
          <div className={stats.length ? 'mt-[30px] border-t border-rule pt-[26px]' : ''}>
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent">Your year with us</div>
            <div className="mt-4 grid grid-cols-2 gap-5 md:grid-cols-4">
              {seasons.map((s, i) => (
                <div key={s.key} className="relative pt-[21px]">
                  <span className="absolute left-0 top-0 h-[9px] w-[9px] rounded-full bg-accent" aria-hidden="true" />
                  {i < seasons.length - 1 && (
                    <span className="absolute left-[13px] top-1 hidden h-px flex-1 bg-rule md:right-[-20px] md:block" aria-hidden="true" />
                  )}
                  <div className="text-[11.5px] font-extrabold uppercase tracking-[0.15em] text-accent">
                    <E p={`about.seasons.${i}.label`}>{s.label}</E>
                  </div>
                  <div className="mt-[5px] text-[14px] leading-[1.5] text-inkSoft">
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
