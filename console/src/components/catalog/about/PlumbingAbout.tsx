'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingAbout — about block, premium pass (2026-11-09, approved mockup's shared language).
// Mirrors HvacAbout's contract with plumbing tokens: about.title / body and the owner's name when
// intake supplied one on the left; the pillars on the right as 20px cards, each with a short
// accent-bar, that lift on hover and arrive in a scroll stagger. No invented copy.
// Every colour is a palette token. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'plumbing-about',
  category: 'about',
  label: 'Plumbing / About',
  consumes: ['about.title', 'about.body', 'about.pillars', 'extensions.ownerName'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function PlumbingAbout({ content = CONTENT }: { content?: SiteContent }) {
  const { about, extensions } = content;
  const ownerName = extensions.ownerName?.trim();

  return (
    <section className="bg-bg py-16 lg:py-[92px]">
      <div className="mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
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
          <ul className="rv-stagger grid gap-3.5">
            {about.pillars.map((p, i) => (
              <li
                key={p.k}
                className="hover-lift shadow-brand-1 rounded-[20px] border border-rule bg-bg px-6 py-5 hover:border-[color:var(--accent-2)] hover:shadow-[0_2px_6px_rgba(16,33,46,0.08),0_14px_30px_-12px_rgba(16,33,46,0.24)]"
              >
                <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
                <h3 className="mt-3 font-heading text-[20px] font-extrabold tracking-[-0.02em] text-ink">
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
