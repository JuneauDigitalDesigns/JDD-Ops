'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DifferentiatorsRail — inline-strip over about.pillars (see the Phase 5 specimen 10).
// The high-on-the-page differentiator band research §3 says recurs in nearly every
// teardown. Carries the claims in ONE band divided by hairlines, NOT four equal icon
// cards (decision 30a): a lead label, then each pillar's title + supporting line,
// separated by vertical rules on desktop. No icon tiles, no accent.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'differentiators-rail',
  category: 'differentiators',
  label: 'Differentiators / Rail',
  consumes: ['about.eyebrow', 'about.pillars'],
  sharedDeps: ['@/lib/skins'],
  skins: ['default', 'soft'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'inline-strip',
  signature: false,
} as const;

export default function DifferentiatorsRail({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const pillars = content.about?.pillars ?? [];
  if (!pillars.length) return null;

  return (
    <section id="differentiators" className={`py-12 ${s.section}`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 lg:flex-row lg:items-stretch lg:gap-0">
        <div className="lg:w-48 lg:shrink-0 lg:pr-8">
          <p className={`font-heading text-sm font-semibold ${s.body}`}><E p="about.eyebrow">{content.about?.eyebrow ?? 'Why us'}</E></p>
        </div>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:flex-1 lg:grid-cols-4 lg:divide-x lg:divide-rule">
          {pillars.map((p, i) => (
            <div key={i} className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
              <p className={`font-heading text-lg font-semibold tracking-[-0.01em] ${s.heading}`}><E p={`about.pillars.${i}.t`}>{p.t}</E></p>
              <p className={`mt-0.5 text-sm ${s.body}`}><E p={`about.pillars.${i}.d`}>{p.d}</E></p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
