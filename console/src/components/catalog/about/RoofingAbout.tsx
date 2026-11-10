'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingAbout — about subpage, premium pass (2026-11-09, approved mockup's roofing language).
// No home-page pane in the mockup (about is subpage-only, like HvacAbout). Title + body + the
// owner's name on the left; on the right the pillars as hairline rows (no cards, no icons), each
// with a small accent square like the coverage index, arriving one after another (rv-stagger).
// Reads about.title/body/pillars + the owner's name when intake supplied one. No invented copy.
// Colours are palette tokens (ink, ink-soft, rule, accent).
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'roofing-about',
  category: 'about',
  label: 'Roofing / About',
  consumes: ['about.title', 'about.body', 'about.pillars', 'extensions.ownerName'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function RoofingAbout({ content = CONTENT }: { content?: SiteContent }) {
  const { about, extensions } = content;
  const ownerName = extensions.ownerName?.trim();

  return (
    <section id="about" className="bg-bg py-16 lg:py-[88px]">
      <div className="mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div>
          <h2 className="font-heading text-[clamp(32px,3.6vw,42px)] font-extrabold leading-[1.0] tracking-[-0.024em] text-ink">
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
          <ul className="rv-stagger grid">
            {about.pillars.map((p, i) => (
              <li key={p.k} className="border-b border-rule py-5 first:pt-0">
                <h3 className="flex items-center gap-3 font-heading text-[20px] font-extrabold tracking-[-0.024em] text-ink">
                  <span className="h-[7px] w-[7px] shrink-0 bg-accent" aria-hidden="true" />
                  <E p={`about.pillars.${i}.t`}>{p.t}</E>
                </h3>
                {p.d ? (
                  <p className="mt-1.5 pl-[19px] text-[15px] leading-[1.6] text-inkSoft">
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
