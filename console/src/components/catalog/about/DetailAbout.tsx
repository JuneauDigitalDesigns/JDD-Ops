'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailAbout — about block, premium pass (2026-11-09, approved mockup's type and material).
// Mirrors HvacAbout's contract exactly: heading, body and the owner's name when intake supplied
// one on the left; the pillars as the same glass cards as DetailServices on the right (they lift
// and their border turns the accent on hover). Reads about.title / body / pillars and
// extensions.ownerName. No invented copy. Every colour is a palette token: glass is ink at 4% / 9%
// over the bg.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'detail-about',
  category: 'about',
  label: 'Car Detailing / About',
  consumes: ['about.title', 'about.body', 'about.pillars', 'extensions.ownerName'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function DetailAbout({ content = CONTENT }: { content?: SiteContent }) {
  const { about, extensions } = content;
  const ownerName = extensions.ownerName?.trim();

  return (
    <section className="bg-bg py-16 sm:py-24">
      <div className="mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div>
          <h2 className="font-heading text-[clamp(34px,4vw,46px)] font-extrabold leading-[1.04] tracking-[-0.016em] text-ink">
            <E p="about.title">{about.title}</E>
          </h2>
          <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.65] text-inkSoft">
            <E p="about.body">{about.body}</E>
          </p>
          {ownerName ? (
            <p className="mt-5 text-[15px] font-semibold text-ink">
              <E p="extensions.ownerName">{ownerName}</E>
              <span className="font-normal text-inkSoft"> · Owner</span>
            </p>
          ) : null}
        </div>

        {about.pillars.length > 0 && (
          <ul className="rv-stagger grid gap-3.5">
            {about.pillars.map((p, i) => (
              <li
                key={p.k}
                className="rounded-[12px] border border-[color:color-mix(in_srgb,var(--ink)_9%,transparent)] bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)] px-6 py-5 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-[3px] hover:border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)]"
              >
                <h3 className="font-heading text-[20px] font-extrabold tracking-[-0.016em] text-ink">
                  <E p={`about.pillars.${i}.t`}>{p.t}</E>
                </h3>
                {p.d ? (
                  <p className="mt-1.5 text-[15px] leading-[1.55] text-inkSoft">
                    <E p={`about.pillars.${i}.d`}>{p.d}</E>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
