'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailAbout — about block, mirrors HvacAbout's contract exactly; bg-bg/text-ink/border-rule
// resolve dark automatically from this vertical's VERTICAL_LANGUAGES entry, with pillar cards
// using the same glass treatment as DetailServices. Reads about.title / body / pillars and the
// owner's name when intake supplied one. No invented copy. Fixed design, no skin.
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
    <section className="bg-bg py-[92px]">
      <div className="mx-auto grid max-w-[1180px] items-start gap-12 px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <h2 className="font-heading text-[40px] font-extrabold leading-[1.0] tracking-[-0.018em] text-ink">
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
                className="rounded-[12px] px-6 py-5"
                style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.085)' }}
              >
                <h3 className="font-heading text-[20px] font-extrabold text-ink">
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
