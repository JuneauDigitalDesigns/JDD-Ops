'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ServicesGrid — recomposed 2026-08-19 against design/catalog-v2/SPEC.md.
//
// Was a Feature + Rail: one large photo panel showing the active service, plus a
// hover-to-swap rail. Two problems. It made the section about browsing rather
// than about what the company fixes, and the feature photo was a single 153KB
// 1200px JPEG that competed with the hero for bandwidth on the critical path —
// the largest remaining request on the page after the hero was fixed.
//
// Now the approved card grid: an icon tile, the service, what it covers, and the
// tag as a plain cue. NO PER-CARD PHOTOGRAPH, which is what removes those bytes
// outright rather than shrinking them. `services.items[].image` is untouched in
// the schema and still used by ServicesAccordion and ServicesPanel, so nothing
// is orphaned — this variant simply does not lead with imagery.
//
// Cards carry real elevation. The old card was a 1px hairline plus a 6% shadow,
// which put it on the same plane as the page and read flat (SPEC §5, and the
// depth note in the mockup).
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'services-grid',
  category: 'services',
  label: 'Services / Card grid',
  consumes: ['services.title', 'services.sub', 'services.items'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins', '@/lib/icons'],
  skins: ['soft', 'default'],
} as const;

export default function ServicesGrid({
  content = CONTENT,
  skin = 'soft',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const dark = skin === 'inverted' || skin === 'contrast';
  const { services } = content;
  if (!services.items.length) return null;

  return (
    <section id="services" className={`${s.section} py-14 lg:py-20`}>
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        {/* No eyebrow. The heading names the section and the line under it carries real
            information, which is the job the wide-tracked kicker was pretending to do. */}
        <div className="max-w-[46ch]">
          <h2 className={`font-heading text-[28px] font-extrabold leading-[1.05] tracking-[-0.015em] sm:text-[34px] lg:text-[40px] ${s.heading}`}>
            <E p="services.title">{services.title}</E>
          </h2>
          <p className={`mt-3.5 text-[17px] leading-relaxed ${s.body}`}>
            <E p="services.sub">{services.sub}</E>
          </p>
        </div>

        <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.items.map((item, i) => (
            <li
              key={item.n ?? i}
              className={`flex flex-col rounded-xl border p-6 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 ${
                dark
                  ? 'border-ruleInk bg-inkPanel2 shadow-[0_14px_30px_-12px_rgba(0,0,0,.5)] hover:shadow-[0_22px_42px_-14px_rgba(0,0,0,.6)]'
                  : 'border-rule/70 bg-bg shadow-[0_1px_2px_rgba(28,16,9,.05),0_14px_30px_-12px_rgba(28,16,9,.22)] hover:shadow-[0_2px_4px_rgba(28,16,9,.06),0_22px_42px_-14px_rgba(28,16,9,.28)]'
              }`}
            >
              <span
                className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl ${
                  dark ? 'bg-white/10 text-onInk' : 'bg-accent100 text-ink'
                }`}
              >
                <Ico p={`services.items.${i}.icon`} icon={serviceIcon(item.icon, item.tag)} size={26} />
              </span>

              <h3 className={`font-heading text-[20px] font-extrabold leading-snug tracking-[-0.01em] ${s.heading}`}>
                <E p={`services.items.${i}.t`}>{item.t}</E>
              </h3>
              <p className={`mt-2.5 text-[16px] leading-relaxed ${s.body}`}>
                <E p={`services.items.${i}.d`}>{item.d}</E>
              </p>

              {/* `tag` is real schema data, so it is shown as-is. There is no per-service
                  availability field, and inventing "same-day" copy here would put a promise
                  on the page that the client never made. */}
              {item.tag && (
                <p className={`mt-5 border-t pt-4 text-[14px] font-bold ${dark ? 'border-ruleInk text-accent200' : 'border-rule text-accent'}`}>
                  <E p={`services.items.${i}.tag`}>{item.tag}</E>
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
