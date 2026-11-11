'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingServiceDetail — the body of one per-service page (/services/<slug>), blocks 4–12 of
// service-page-spec.md §3, in the approved Plumbing language (service-pages mockup, `.v-plumb`,
// Xander 2026-11-10): pill geometry throughout, the "Signs" panel on accent2's soft tint, the
// price card as a blue gradient from the accent into the dark panel, the towns as centred chips
// (`pl-cov`), the questions as cards (`faqcards`) and the related services as the home grid's
// badge cards (`pl-svc`), as links. Every block renders ONE service's own content and is omitted
// when its data is absent (D5); no block is a site-wide section, so no two service pages share a body.
//   4  What's included        services.items[i].included        (client)
//   5  Signs it's time to call services.items[i].typicalJobs     (client)
//   6  What to expect          services.items[i].page.expect     (generated from stated facts)
//   7  Starting at             services.items[i].priceFrom       ("Ask for a quote" → the form)
//   8  Areas we serve          services.items[i].areas           (own towns only, hidden if none)
//   9  Brands we work with     services.items[i].brands
//   10 Common questions        tagged customer questions, then page.faq (3–5)
//   11 Proof                   reviews + job photos tagged to this service (never the main photo twice)
//   12 Related services        2–3 sibling services that have pages, same tag first
// Block 13 is PlumbingFinalCta (id="cta"), which wirePages gives the same serviceSlug.
//
// Each block carries its own `rv` scroll reveal, so this component is in SELF_ANIMATED
// (revealPolicy.ts): a reveal on the whole body would fade a page-tall block. Edit paths use the
// ORIGINAL services.items index. Headings were approved word for word on 2026-11-10; "Coverage"
// is the eyebrow PlumbingTrust already carries.
// Colours: every one is a palette token. accent2 is this vertical's light blue, so it is used for
// emphasis on dark surfaces and for decoration, never for text on a light one.
// ─────────────────────────────────────────────────────────────────────────────
import { Check, CaretDown, Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';
import { CoverImage } from '@/lib/CoverImage';
import {
  relatedServices, serviceBySlug, serviceList, serviceProof, serviceQuestions,
} from '@/lib/serviceLinks';

export const meta = {
  id: 'plumbing-service-detail',
  category: 'services',
  label: 'Plumbing / Service page body',
  consumes: ['services.items', 'servicePages', 'testimonials.items', 'work.projects', 'extensions.customerQuestions'],
  sharedDeps: ['@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable', '@/lib/icons', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Approved word for word, 2026-11-10 ("Coverage" is PlumbingTrust's existing eyebrow). */
export const SERVICE_PAGE_WORDS = {
  included: "What's included",
  signs: "Signs it's time to call",
  expect: 'What to expect',
  startingAt: 'Starting at',
  askForQuote: 'Ask for a quote',
  areas: 'Areas we serve',
  areasEyebrow: 'Coverage',
  brands: 'Brands we work with',
  questions: 'Common questions',
  related: 'Related services',
} as const;

const Cap = ({ center = false }: { center?: boolean }) => (
  <span className={`accent-bar mb-[18px] block !h-1 !w-11 !rounded-full ${center ? 'mx-auto' : ''}`} aria-hidden="true" />
);

const h2Md = 'font-heading text-[30px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink lg:text-[36px]';

export default function PlumbingServiceDetail({ content = CONTENT, serviceSlug }: { content?: SiteContent; serviceSlug?: string }) {
  const s = serviceBySlug(content, serviceSlug);
  if (!s) return null;
  const W = SERVICE_PAGE_WORDS;
  const n = s.index;
  const included = serviceList(s, 'included');
  const jobs = serviceList(s, 'typicalJobs');
  const expect = (Array.isArray((s.item.page as { expect?: unknown } | undefined)?.expect)
    ? ((s.item.page as { expect: unknown[] }).expect)
    : []
  )
    .map((v, i) => ({ text: typeof v === 'string' ? v.trim() : '', i }))
    .filter((x) => x.text);
  const price = typeof s.item.priceFrom === 'string' ? s.item.priceFrom.trim() : '';
  const areas = serviceList(s, 'areas');
  const brands = serviceList(s, 'brands');
  const questions = serviceQuestions(content, s);
  const { reviews, photos } = serviceProof(content, s);
  const related = relatedServices(content, s);
  const review = reviews[0];

  return (
    <>
      {(included.length > 0 || jobs.length > 0) && (
        <section className="rv bg-bg py-16 lg:py-[92px]">
          <div className={`mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:gap-14 ${included.length && jobs.length ? 'lg:grid-cols-2' : ''}`}>
            {included.length > 0 && (
              <div>
                <Cap />
                <h2 className="font-heading text-[34px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink lg:text-[46px]">{W.included}</h2>
                <ul className="mt-[26px] border-t border-rule">
                  {included.map((x) => (
                    <li key={x.i} className="flex items-start gap-3.5 border-b border-rule py-4 text-[16px] font-semibold leading-[1.45] text-ink">
                      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[color:var(--accent-2-soft)] text-accent">
                        <Check size={15} weight="bold" aria-hidden="true" />
                      </span>
                      <E p={`services.items.${n}.included.${x.i}`}>{x.text}</E>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {jobs.length > 0 && (
              <div className="relative rounded-[20px] bg-[color:var(--accent-2-soft)] px-[22px] pb-[18px] pt-[26px] lg:mt-[22px] lg:px-8 lg:pb-[22px] lg:pt-8">
                <span className="absolute bottom-8 left-0 top-8 w-1 rounded-r bg-[color:var(--accent-2)]" aria-hidden="true" />
                <h2 className={h2Md}>{W.signs}</h2>
                <ol className="mt-[18px]">
                  {jobs.map((x, k) => (
                    <li key={x.i} className={`flex items-baseline gap-4 py-[13px] text-[16px] leading-[1.5] text-ink ${k ? 'border-t border-rule' : ''}`}>
                      <span className="shrink-0 font-heading text-[14px] font-extrabold leading-none text-accent tabular-nums" aria-hidden="true">
                        {String(k + 1).padStart(2, '0')}
                      </span>
                      <E p={`services.items.${n}.typicalJobs.${x.i}`}>{x.text}</E>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </section>
      )}

      {(expect.length > 0 || price) && (
        <section className="rv bg-bgSoft py-16 lg:py-[88px]">
          <div className={`mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:gap-14 ${expect.length && price ? 'lg:grid-cols-[1.25fr_0.75fr]' : ''}`}>
            {expect.length > 0 && (
              <div>
                <Cap />
                <h2 className={h2Md}>{W.expect}</h2>
                <ol className="mt-7">
                  {expect.map((x, k) => (
                    <li key={x.i} className="relative pb-[26px] pl-[60px] text-[16.5px] leading-[1.55] text-ink last:pb-0">
                      <span className="absolute left-0 top-[-6px] grid h-10 w-10 place-items-center rounded-full bg-accent font-heading text-[17px] font-extrabold text-accentFg" aria-hidden="true">
                        {k + 1}
                      </span>
                      {k < expect.length - 1 && <span className="absolute bottom-0.5 left-[19px] top-[42px] w-0.5 bg-rule" aria-hidden="true" />}
                      <E p={`services.items.${n}.page.expect.${x.i}`}>{x.text}</E>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {price && (
              <aside
                id="pricing"
                className="relative scroll-mt-24 overflow-hidden rounded-[20px] p-8 text-onInk"
                style={{
                  background: 'linear-gradient(135deg, var(--accent), var(--ink-panel-2))',
                  boxShadow:
                    '0 10px 24px color-mix(in srgb, var(--ink-panel) 14%, transparent), 0 40px 70px -30px color-mix(in srgb, var(--ink-panel) 50%, transparent)',
                }}
              >
                <span className="accent-bar absolute inset-x-0 top-0 !h-1 !w-auto !rounded-none" aria-hidden="true" />
                <span className="block text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">{W.startingAt}</span>
                <b className="mt-3 block font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] lg:text-[54px]">
                  <E p={`services.items.${n}.priceFrom`}>{price}</E>
                </b>
                <a
                  href="#cta"
                  className="mt-6 flex w-full items-center justify-center rounded-full bg-accent px-[22px] py-[14px] text-[16px] font-bold text-accentFg shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--on-ink)_22%,transparent)] transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
                >
                  {W.askForQuote}
                </a>
              </aside>
            )}
          </div>
        </section>
      )}

      {areas.length > 0 && (
        <section className="rv bg-[color:var(--accent-2-soft)] py-14 text-center lg:py-[88px]">
          <div className="mx-auto max-w-[800px] px-5 sm:px-6">
            <div className="flex items-center justify-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              {W.areasEyebrow}
            </div>
            <h2 className="mt-3.5 font-heading text-[clamp(30px,3.4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{W.areas}</h2>
            <ul className="mt-[34px] grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-[10px]">
              {areas.map((x) => (
                <li
                  key={x.i}
                  className="shadow-brand-1 flex items-center justify-center rounded-full border border-rule bg-bg px-3 py-[10px] text-[14px] font-bold text-ink transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-[color:var(--accent-2)] hover:bg-[color:color-mix(in_srgb,var(--accent-2)_10%,var(--bg))] sm:px-[15px] sm:text-[15px]"
                >
                  <E p={`services.items.${n}.areas.${x.i}`}>{x.text}</E>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {brands.length > 0 && (
        <section className="border-b border-rule bg-bg">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-7 gap-y-3.5 px-5 py-[30px] sm:px-6">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-inkSoft">{W.brands}</h2>
            <ul className="flex flex-wrap gap-2.5">
              {brands.map((x) => (
                <li key={x.i} className="rounded-full border border-rule bg-bg px-[18px] py-[11px] font-heading text-[16px] font-extrabold leading-none tracking-[-0.01em] text-ink">
                  <E p={`services.items.${n}.brands.${x.i}`}>{x.text}</E>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section id="questions" className="rv scroll-mt-20 bg-bgSoft py-14 lg:py-[84px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <div className="mx-auto max-w-[640px] text-center">
              <Cap center />
              <h2 className={h2Md}>{W.questions}</h2>
            </div>
            <div className="mx-auto mt-9 max-w-[800px]">
              {questions.map((f, k) => (
                <details
                  key={f.path}
                  open={k === 0}
                  className="group mt-[11px] overflow-hidden rounded-[20px] border border-l-[3px] border-rule border-l-transparent bg-bg transition-colors duration-300 open:border-l-accent open:bg-bgSoft"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-[18px] text-[16px] font-bold leading-[1.25] tracking-[-0.012em] text-ink sm:px-6 sm:py-5 sm:text-[16.5px] [&::-webkit-details-marker]:hidden">
                    <E p={`${f.path}.q`}>{f.q}</E>
                    <CaretDown size={18} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="px-5 pb-6 text-[15.5px] leading-[1.72] text-inkSoft sm:px-6">
                    <E p={`${f.path}.a`}>{f.a}</E>
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {(review || photos.length > 0) && (
        <section className="rv bg-bgSoft py-16 lg:py-[88px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <div className={`grid items-stretch gap-4 lg:gap-[22px] ${review && photos.length ? 'lg:grid-cols-[1.35fr_1fr]' : photos.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {review && (
                <figure className="shadow-brand-1 relative flex flex-col justify-center overflow-hidden rounded-[20px] border border-rule bg-bg p-7 lg:p-10">
                  <span className="pointer-events-none absolute right-[30px] top-[-2px] font-heading text-[140px] font-extrabold leading-none text-[color:var(--accent-2-soft)]" aria-hidden="true">
                    &rdquo;
                  </span>
                  <div className="relative flex" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, j) => (
                      <Star key={j} size={15} weight="fill" className="text-[color:var(--star)]" />
                    ))}
                  </div>
                  <blockquote className="relative mt-5 max-w-[26ch] text-[19px] font-medium leading-[1.35] tracking-[-0.012em] text-ink sm:text-[22px] lg:text-[clamp(22px,2.2vw,28px)]">
                    <E p={`${review.path}.q`}>{review.q}</E>
                  </blockquote>
                  <figcaption className="relative mt-8 flex items-center gap-3">
                    <span
                      className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full font-heading text-[21px] font-extrabold text-onInk"
                      style={{ background: 'linear-gradient(145deg, var(--accent), var(--ink-panel-2))' }}
                      aria-hidden="true"
                    >
                      {review.a.trim().charAt(0).toUpperCase()}
                    </span>
                    <span>
                      <b className="block text-[15px] text-ink"><E p={`${review.path}.a`}>{review.a}</E></b>
                      {review.r && <small className="text-[13px] text-inkSoft">{review.r}</small>}
                    </span>
                  </figcaption>
                </figure>
              )}
              {photos.slice(0, review ? 1 : 3).map((ph) => (
                <figure key={ph.path} className="shadow-brand-1 flex flex-col overflow-hidden rounded-[20px] border border-rule bg-bg">
                  <div className="relative min-h-[220px] flex-1 isolate overflow-hidden">
                    <CoverImage url={ph.url} alt={ph.alt} sizes="(min-width: 1024px) 50vw, 100vw" />
                  </div>
                  {(ph.title || ph.meta) && (
                    <figcaption className="px-[22px] py-[18px]">
                      {ph.title && <b className="block font-heading text-[18px] font-extrabold leading-[1.2] tracking-[-0.02em] text-ink"><E p={`${ph.path}.t`}>{ph.title}</E></b>}
                      {ph.meta && <small className="mt-1 block text-[13.5px] text-inkSoft">{ph.meta}</small>}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="rv bg-bg py-16 lg:py-[92px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <h2 className={h2Md}>{W.related}</h2>
            <ul className="rv-stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-[22px]">
              {related.map((r) => {
                const item = content.services.items[r.index];
                const d = item?.d?.trim();
                return (
                  <li key={r.slug} className="flex">
                    <a
                      href={r.href!}
                      className="group hover-lift shadow-brand-1 relative flex w-full flex-col rounded-[20px] border border-rule bg-bg p-6 hover:shadow-[0_4px_10px_color-mix(in_srgb,var(--ink-panel)_9%,transparent),0_26px_50px_-16px_color-mix(in_srgb,var(--ink-panel)_30%,transparent)] lg:p-7"
                    >
                      {r.tag && (
                        <span className="absolute right-[22px] top-[22px] rounded-full bg-bgSoft px-[11px] py-[6px] text-[11px] font-bold uppercase leading-none tracking-[0.09em] text-accent">
                          {r.tag}
                        </span>
                      )}
                      <span className="mb-[18px] grid h-14 w-14 place-items-center rounded-full bg-[color:var(--accent-2-soft)] text-accent transition-[background-color,color,transform] duration-300 group-hover:scale-[1.06] group-hover:bg-accent group-hover:text-accentFg">
                        <Ico icon={serviceIcon(item?.icon, item?.tag)} size={24} />
                      </span>
                      <h3 className="pr-[10px] font-heading text-[21px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
                        <E p={`services.items.${r.index}.t`}>{r.t}</E>
                      </h3>
                      {d && (
                        <p className="mt-2.5 text-[15px] leading-[1.62] text-inkSoft">
                          <E p={`services.items.${r.index}.d`}>{d}</E>
                        </p>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
