'use client';
import { ShieldCheck, SealCheck, Certificate } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'trust-license-insurance',
  category: 'trust',
  label: 'Trust / License & Insurance',
  consumes: ['brand.license', 'brand.long', 'extensions.trustBadges', 'trust.label'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins'],
  skins: ['editorial', 'contrast'],
} as const;

export default function TrustLicenseInsurance({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const { brand, extensions } = content;
  const badges = extensions?.trustBadges ?? [];
  return (
    <section className={`border-y ${s.rule} ${s.section} px-6 py-11`}>
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
        <div className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold ${s.heading}`}>
          <span className="inline-flex items-center gap-2"><ShieldCheck size={20} weight="fill" className="text-accent" />Licensed</span>
          <span className="inline-flex items-center gap-2"><SealCheck size={20} weight="fill" className="text-accent" />Bonded</span>
          <span className="inline-flex items-center gap-2"><Certificate size={20} weight="fill" className="text-accent" />Insured</span>
          {brand.license && (
            <span className={`text-xs ${s.body}`}>License&nbsp;<E p="brand.license">{brand.license}</E></span>
          )}
        </div>
        {badges.length > 0 && (
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {badges.map((b, i) => (
              <li key={b} className={`rounded-full border ${s.cardRule} ${s.card} px-3 py-1 text-xs ${s.body}`}>
                <E p={`extensions.trustBadges.${i}`}>{b}</E>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
