'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnAbout — about subpage, premium pass (2026-11-09, approved mockup). Story + owner line on
// the left; on the right the pillars as a two-column HAIRLINE list (accent-bar caps over each
// title) instead of a stack of cards, arriving one after another (rv-stagger). Reads
// about.title/body/pillars + the owner's name when intake supplied one. No invented copy. Every
// colour is a palette token. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'lawn-about',
  category: 'about',
  label: 'Lawn / About',
  consumes: ['about.title', 'about.body', 'about.pillars', 'extensions.ownerName'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function LawnAbout({ content = CONTENT }: { content?: SiteContent }) {
  const { about, extensions } = content;
  const ownerName = extensions.ownerName?.trim();

  return (
    <section id="about" className="bg-bg py-16 lg:py-24">
      <div className="mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <h2 className="font-heading text-[34px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink lg:text-[46px]">
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
          <ul className="rv-stagger grid gap-x-8 border-t border-rule sm:grid-cols-2">
            {about.pillars.map((p, i) => (
              <li key={p.k} className="border-b border-rule py-5">
                <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
                <h3 className="mt-3 font-heading text-[19px] font-extrabold tracking-[-0.015em] text-ink">
                  <E p={`about.pillars.${i}.t`}>{p.t}</E>
                </h3>
                {p.d ? (
                  <p className="mt-1.5 text-[14.5px] leading-[1.55] text-inkSoft">
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
