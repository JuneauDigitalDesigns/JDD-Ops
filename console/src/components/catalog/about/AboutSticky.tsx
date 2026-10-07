'use client';
// ─────────────────────────────────────────────────────────────────────────────
// AboutSticky — sticky-swap about section (see the Phase 5 specimen 13). On desktop the
// left panel (title + lead) pins while the body and pillars scroll past it; at 390 it is
// a plain stack with no sticky behaviour (SPEC §8: desktop may only add room, never
// meaning). Unique within the about category (AboutFeature=count-up-centerpiece,
// AboutStory=asymmetric-split).
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'about-sticky',
  category: 'about',
  label: 'About / Sticky',
  consumes: ['about.eyebrow', 'about.title', 'about.body', 'about.pillars'],
  sharedDeps: ['@/lib/skins'],
  skins: ['default', 'soft'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'sticky-swap',
  signature: false,
} as const;

export default function AboutSticky({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const about = content.about;
  if (!about || !about.body) return null;
  const pillars = about.pillars ?? [];

  return (
    <section id="about" className={`py-24 ${s.section}`}>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[40%_minmax(0,1fr)] lg:items-start lg:gap-16">
        <div className="lg:sticky lg:top-16">
          {about.eyebrow && <p className={`text-sm font-semibold ${s.body}`}><E p="about.eyebrow">{about.eyebrow}</E></p>}
          <h2 className={`mt-2 font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="about.title">{about.title}</E></h2>
        </div>
        <div>
          <p className={`text-lg leading-relaxed ${s.body}`}><E p="about.body">{about.body}</E></p>
          {pillars.length > 0 && (
            <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {pillars.map((p, i) => (
                <div key={i} className={`border-t ${s.rule} pt-4`}>
                  <dt className={`font-heading text-base font-semibold ${s.heading}`}><E p={`about.pillars.${i}.t`}>{p.t}</E></dt>
                  <dd className={`mt-1 text-sm ${s.body}`}><E p={`about.pillars.${i}.d`}>{p.d}</E></dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
