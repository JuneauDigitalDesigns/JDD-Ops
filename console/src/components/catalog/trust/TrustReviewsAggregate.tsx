'use client';
import { Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'trust-reviews-aggregate',
  category: 'trust',
  label: 'Trust / Reviews Aggregate',
  consumes: ['extensions.reviewBadge', 'trust.label', 'testimonials.items'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins'],
  skins: ['editorial', 'contrast'],
} as const;

export default function TrustReviewsAggregate({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const { extensions, testimonials, trust } = content;
  const rating = extensions?.reviewBadge?.rating ?? 4.9;
  const count = extensions?.reviewBadge?.count ?? testimonials?.items?.length ?? 0;
  const full = Math.round(rating);
  return (
    <section className={`px-6 py-14 ${s.section}`}>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-1 text-accent">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={30} weight={i < full ? 'fill' : 'regular'} />
          ))}
        </div>
        <p className={`font-heading text-4xl font-bold ${s.heading}`}>{rating.toFixed(1)} out of 5</p>
        <p className={s.body}>
          Rated by <span className={`font-semibold ${s.heading}`}>{count}+</span>{' '}
          <E p="trust.label">{trust?.label ?? 'verified customers'}</E>
        </p>
      </div>
    </section>
  );
}
