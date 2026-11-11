'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacAbout — Northstar about block, premium pass (2026-11-09, approved mockup). Story + owner
// line on the left with the pillars as a two-column HAIRLINE list (accent-bar caps) instead of a
// stack of cards; on the right the feature photo (images.about.feature, 4:5, navy wash) on an
// offset steel block, the page's one asymmetric element. Reads about.title / body / pillars,
// images.about.feature and the owner's name when intake supplied one. No invented copy; the photo
// is omitted when the slot is empty. Every colour is a palette token.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { CoverImage } from '@/lib/CoverImage';

export const meta = {
  id: 'hvac-about',
  category: 'about',
  label: 'HVAC / About',
  consumes: ['about.eyebrow', 'about.title', 'about.body', 'about.pillars', 'extensions.ownerName', 'images.about.feature'],
  sharedDeps: ['@/lib/CoverImage', '@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function HvacAbout({ content = CONTENT }: { content?: SiteContent }) {
  const { about, extensions, images } = content;
  const ownerName = extensions.ownerName?.trim();
  const feature = images.about?.feature;

  return (
    <section id="about" className="bg-bg py-16 lg:py-24">
      <div className={`mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 ${feature ? 'lg:grid-cols-[1.05fr_0.95fr] lg:gap-16' : ''}`}>
        <div>
          {about.eyebrow && (
            <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              <E p="about.eyebrow">{about.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-4 font-heading text-[34px] font-semibold leading-[1.04] tracking-[-0.01em] text-ink lg:text-[46px]">
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

          {about.pillars.length > 0 && (
            <ul className="rv-stagger mt-9 grid gap-x-8 border-t border-rule sm:grid-cols-2">
              {about.pillars.map((p, i) => (
                <li key={p.k} className="border-b border-rule py-5">
                  <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
                  <h3 className="mt-3 font-heading text-[19px] font-semibold text-ink">
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

        {feature && (
          <div className="relative ml-4 mt-3">
            <span className="absolute -left-4 -top-4 h-[60%] w-[60%] rounded-[16px] bg-[color:var(--accent-2-soft)]" aria-hidden="true" />
            <div
              className="shadow-brand-3 relative aspect-[4/5] overflow-hidden rounded-[16px] isolate"
            >
              <CoverImage url={feature} alt={`${content.brand.name} team`} sizes="(min-width: 1024px) 50vw, 100vw" />
              <div className="absolute inset-0 bg-[color:var(--accent-2)] opacity-30 mix-blend-color" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
