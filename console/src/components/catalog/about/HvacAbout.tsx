'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacAbout — Northstar about block. Reads about.title / body / pillars and the
// owner's name when intake supplied one. No invented copy. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'hvac-about',
  category: 'about',
  label: 'HVAC / About',
  consumes: ['about.title', 'about.body', 'about.pillars', 'extensions.ownerName'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function HvacAbout({ content = CONTENT }: { content?: SiteContent }) {
  const { about, extensions } = content;
  const ownerName = extensions.ownerName?.trim();

  return (
    <section id="about" className="bg-bg py-[84px]">
      <div className="mx-auto grid max-w-[1120px] items-start gap-12 px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <h2 className="font-heading text-[40px] font-semibold leading-[1.04] tracking-[-0.01em] text-ink">
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
          <ul className="grid gap-3.5">
            {about.pillars.map((p, i) => (
              <li
                key={p.k}
                className="rounded-2xl border border-rule bg-bg px-6 py-5 shadow-[0_1px_2px_rgba(19,41,63,0.06)]"
              >
                <h3 className="font-heading text-[20px] font-semibold text-ink">
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
