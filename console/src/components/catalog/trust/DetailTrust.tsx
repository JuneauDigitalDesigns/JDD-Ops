'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailTrust — centred mobile-radius statement over a concentric-ring watermark, mirrored 1:1
// (#detail .area/.rings/.run). Towns render as a gold-dotted inline run, not chips (every other
// vertical's treatment). `extensions.serviceRadiusMiles` absent -> the radius-specific headline
// and ring drop to a generic coverage statement; the town run still renders on its own
// (PLAN D5/D15 — we never invent a mileage figure the client didn't give us). Reads
// extensions.serviceArea. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'detail-trust',
  category: 'trust',
  label: 'Car Detailing / Mobile radius',
  consumes: ['extensions.serviceArea', 'extensions.serviceRadiusMiles'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function DetailTrust({ content = CONTENT }: { content?: SiteContent }) {
  const towns = content.extensions.serviceArea ?? [];
  const radius = content.extensions.serviceRadiusMiles?.trim();
  if (!towns.length) return null;

  return (
    <section className="relative overflow-hidden bg-bgSoft py-[92px] text-center">
      <svg
        viewBox="0 0 400 400"
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 w-[760px] max-w-[120%] -translate-x-1/2 -translate-y-1/2 text-accent opacity-[0.13]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <circle cx="200" cy="200" r="70" />
        <circle cx="200" cy="200" r="118" />
        <circle cx="200" cy="200" r="166" />
        <circle cx="200" cy="200" r="198" />
      </svg>

      <div className="relative mx-auto max-w-[720px] px-6">
        <div className="text-[11.5px] font-bold uppercase tracking-[0.26em] text-accent">
          {radius ? 'Mobile radius' : 'Service area'}
        </div>
        <h2 className="mt-4 font-heading text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.05] text-ink">
          {radius ? (
            <>
              We come to you, <E p="extensions.serviceRadiusMiles">{radius}</E> miles out from the studio.
            </>
          ) : (
            'Serving the whole area, studio or mobile.'
          )}
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-[16px] leading-[1.6] text-inkSoft">
          {radius
            ? 'No mobile fee inside the ring. Beyond it, call — for coating and correction work we travel further.'
            : "Not on the list? Call and ask — we'll tell you straight whether we can get to you."}
        </p>
        <div className="mt-[30px] flex flex-wrap items-center justify-center gap-y-2.5">
          {towns.map((town, i) => (
            <span key={town} className="flex items-center">
              {i > 0 && <span className="mx-4 h-[5px] w-[5px] shrink-0 rounded-full bg-accent" aria-hidden="true" />}
              <span className="text-[14.5px] font-semibold text-inkSoft">
                <E p={`extensions.serviceArea.${i}`}>{town}</E>
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
