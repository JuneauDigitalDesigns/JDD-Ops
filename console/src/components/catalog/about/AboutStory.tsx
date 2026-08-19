'use client';
// ─────────────────────────────────────────────────────────────────────────────
// AboutStory — recomposed 2026-08-19 against design/catalog-v2/SPEC.md.
//
// Removed: the wide-tracked uppercase eyebrow and its hairline dash, the
// hairline-divided pillar list, and the faded 25%-opacity ordinal numerals —
// the same magazine-index device cut from the hero. Pillars are cards now, so
// they read as things the company does rather than as a table of contents.
//
// Also removed the per-pillar staggered reveal. Four short items do not need to
// arrive one at a time, and the stagger was the only reason this file needed
// framer-motion.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { pillarIcon } from '@/lib/icons';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'about-story',
  category: 'about',
  label: 'About / Story',
  consumes: ['about.title', 'about.body', 'about.pillars'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins', '@/lib/icons'],
  skins: ['default', 'soft'],
} as const;

export default function AboutStory({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const dark = skin === 'inverted' || skin === 'contrast';
  const { about } = content;

  return (
    <section id="about" className={`${s.section} py-14 lg:py-20`}>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className={`font-heading text-[28px] font-extrabold leading-[1.05] tracking-[-0.015em] sm:text-[34px] lg:text-[40px] ${s.heading}`}>
            <E p="about.title">{about.title}</E>
          </h2>
          <p className={`mt-4 text-[17px] leading-relaxed sm:text-[18px] ${s.body}`}>
            <E p="about.body">{about.body}</E>
          </p>
        </div>

        {about.pillars.length > 0 && (
          <ul className="grid gap-3.5">
            {about.pillars.map((p, i) => {
              const Icon = pillarIcon(p.icon, p.k);
              return (
                <li
                  key={p.k}
                  className={`rounded-xl border p-5 ${
                    dark
                      ? 'border-ruleInk bg-inkPanel2'
                      : 'border-rule/70 bg-bgSoft shadow-[0_1px_2px_rgba(28,16,9,.04)]'
                  }`}
                >
                  <h3 className={`flex items-center gap-2.5 font-heading text-[18px] font-extrabold ${s.heading}`}>
                    {Icon && <Ico p={`about.pillars.${i}.icon`} icon={Icon} size={21} className="shrink-0 text-accent" />}
                    <E p={`about.pillars.${i}.t`}>{p.t}</E>
                  </h3>
                  <p className={`mt-2 text-[16px] leading-relaxed ${s.body}`}>
                    <E p={`about.pillars.${i}.d`}>{p.d}</E>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
