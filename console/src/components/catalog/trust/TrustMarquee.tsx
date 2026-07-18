'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { stillFor } from '@/lib/motion';

export const meta = {
  id: 'trust-marquee',
  category: 'trust',
  label: 'Trust / Marquee',
  consumes: ['trust.label', 'trust.logos'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast', 'quiet'],
} as const;

export default function TrustMarquee({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { trust } = content;
  if (!trust.logos.length) return null;

  const doubled = [...trust.logos, ...trust.logos];

  return (
    <section className={`border-b ${s.rule} ${s.section} py-9`}>
      <div className="mx-auto max-w-6xl px-6">
        <p className={`mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] ${s.eyebrow}`}>
          <E p="trust.label">{trust.label}</E>
        </p>
      </div>

      <div
        className="overflow-hidden"
        style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)', maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
      >
        {still ? (
          <div className="flex flex-wrap justify-center gap-6 px-6">
            {trust.logos.map((logo, i) => (
              <span key={i} className={`rounded-full border ${s.rule} px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${s.body}`}><E p={`trust.logos.${i}`}>{logo}</E></span>
            ))}
          </div>
        ) : (
          <motion.div
            className="flex gap-6 whitespace-nowrap"
            style={{ width: 'max-content' }}
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
          >
            {doubled.map((logo, i) => (
              <span key={i} className={`inline-flex items-center rounded-full border ${s.rule} px-5 py-2 text-xs font-semibold uppercase tracking-wider ${s.body}`}>
                {logo}
              </span>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
