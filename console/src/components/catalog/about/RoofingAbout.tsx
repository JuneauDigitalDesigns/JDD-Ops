'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingAbout — about subpage. No home-page pane in the mockup (about is subpage-only, like
// HvacAbout); mirrors its structure with roofing's hairline-card language (4px radius, border,
// no shadow) instead of HVAC's soft-shadow rounded pillars. Reads about.title/body/pillars + the
// owner's name when intake supplied one. No invented copy. Fixed design, no skin.
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
    <section id="about" className="bg-bg py-[88px]">
      <div className="mx-auto grid max-w-[1160px] items-start gap-12 px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <h2 className="font-heading text-[40px] font-extrabold leading-[0.98] tracking-[-0.024em] text-ink">
            <E p="about.title">{about.title}</E>
          </h2>
          <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.62] text-inkSoft">
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
              <li key={p.k} className="border-b border-rule px-0 py-5 first:pt-0">
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
