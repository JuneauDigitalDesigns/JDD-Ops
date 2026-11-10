'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacServiceDetail — the body of one per-service page (/services/<slug>), blocks 4–12 of
// service-page-spec.md §3, in the approved HVAC language (service-pages mockup v6, Xander
// 2026-11-10). Every block renders ONE service's own content and is omitted when its data is
// absent (D5); no block is a site-wide section, so no two service pages share a body.
//   4  What's included        services.items[i].included        (client)
//   5  Signs it's time to call services.items[i].typicalJobs     (client)
//   6  What to expect          services.items[i].page.expect     (generated from stated facts)
//   7  Starting at             services.items[i].priceFrom       ("Ask for a quote" → the form)
//   8  Areas we serve          services.items[i].areas           (own towns only, hidden if none)
//   9  Brands we work with     services.items[i].brands
//   10 Common questions        tagged customer questions, then page.faq (3–5)
//   11 Proof                   reviews + job photos tagged to this service (never the main photo twice)
//   12 Related services        2–3 sibling services that have pages, same tag first
// Block 13 is the vertical's own final CTA, which wirePages gives the same serviceSlug.
//
// Each block carries its own `rv` scroll reveal, so this component is in SELF_ANIMATED
// (revealPolicy.ts): a reveal on the whole body would fade a page-tall block. Edit paths use the
// ORIGINAL services.items index. Headings were approved word for word on 2026-11-10.
// ─────────────────────────────────────────────────────────────────────────────
import { Check, MapPin, Plus, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { imageAt } from '@/lib/localImage';
import {
  relatedServices, serviceBySlug, serviceList, serviceProof, serviceQuestions,
} from '@/lib/serviceLinks';

export const meta = {
  id: 'hvac-service-detail',
  category: 'services',
  label: 'HVAC / Service page body',
  consumes: ['services.items', 'servicePages', 'testimonials.items', 'work.projects', 'extensions.customerQuestions', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/localImage', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Approved word for word, 2026-11-10. */
export const SERVICE_PAGE_WORDS = {
  included: "What's included",
  signs: "Signs it's time to call",
  expect: 'What to expect',
  startingAt: 'Starting at',
  askForQuote: 'Ask for a quote',
  areas: 'Areas we serve',
  areasEyebrow: 'Service area',
  brands: 'Brands we work with',
  questions: 'Common questions',
  related: 'Related services',
} as const;

const Cap = ({ center = false }: { center?: boolean }) => (
  <span className={`accent-bar mb-[18px] !h-1 !w-11 ${center ? 'mx-auto' : ''}`} aria-hidden="true" />
);

export default function HvacServiceDetail({ content = CONTENT, serviceSlug }: { content?: SiteContent; serviceSlug?: string }) {
  const s = serviceBySlug(content, serviceSlug);
  if (!s) return null;
  const W = SERVICE_PAGE_WORDS;
  const { brand } = content;
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
        <section className="rv bg-bg py-16 lg:py-24">
          <div className={`mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:gap-16 ${included.length && jobs.length ? 'lg:grid-cols-2' : ''}`}>
            {included.length > 0 && (
              <div>
                <Cap />
                <h2 className="font-heading text-[34px] font-semibold leading-[1.04] text-ink lg:text-[46px]">{W.included}</h2>
                <ul className="mt-7 border-t border-rule">
                  {included.map((x) => (
                    <li key={x.i} className="flex items-start gap-3.5 border-b border-rule py-4 text-[16px] font-semibold leading-[1.45] text-ink">
                      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[color:var(--accent-2-soft)] text-[color:var(--accent-2)]">
                        <Check size={15} weight="bold" aria-hidden="true" />
                      </span>
                      <E p={`services.items.${n}.included.${x.i}`}>{x.text}</E>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {jobs.length > 0 && (
              <div className="relative rounded-[18px] bg-bgSoft p-7 shadow-[inset_0_0_0_1px_var(--rule)] lg:mt-[22px] lg:p-[34px]">
                <span className="accent-bar absolute bottom-[34px] left-0 top-[34px] !h-auto !w-1 !rounded-l-none" aria-hidden="true" />
                <h2 className="font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]">{W.signs}</h2>
                <ul className="mt-5">
                  {jobs.map((x, k) => (
                    <li key={x.i} className={`relative py-3 pl-[30px] text-[16px] leading-[1.5] text-ink ${k ? 'border-t border-rule' : ''}`}>
                      <span className="absolute left-0 top-[19px] h-3.5 w-3.5 rounded-full border-[3px] border-accent" aria-hidden="true" />
                      <E p={`services.items.${n}.typicalJobs.${x.i}`}>{x.text}</E>
                    </li>
                  ))}
                </ul>
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
                <h2 className="font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]">{W.expect}</h2>
                <ol className="mt-7">
                  {expect.map((x, k) => (
                    <li key={x.i} className="relative pb-[26px] pl-[62px] text-[16.5px] leading-[1.55] text-ink last:pb-0">
                      <span className="shadow-brand-2 absolute left-0 top-[-4px] grid h-10 w-10 place-items-center rounded-full bg-bg font-heading text-[18px] font-semibold text-[color:var(--accent-2)]" aria-hidden="true">
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
              <aside id="pricing" className="shadow-brand-3 relative scroll-mt-24 overflow-hidden rounded-[18px] bg-inkPanel p-8 text-onInk">
                <span className="accent-bar absolute inset-x-0 top-0 !h-1 !w-auto !rounded-none" aria-hidden="true" />
                <span className="block text-[12px] font-bold uppercase tracking-[0.14em] text-[color:color-mix(in_srgb,var(--accent-2)_45%,var(--on-ink))]">{W.startingAt}</span>
                <b className="mt-3 block font-heading text-[46px] font-semibold leading-none tabular-nums lg:text-[56px]">
                  <E p={`services.items.${n}.priceFrom`}>{price}</E>
                </b>
                <a
                  href="#cta"
                  className="mt-6 flex w-full items-center justify-center rounded-[10px] bg-accent px-[22px] py-[14px] text-[16px] font-bold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105"
                >
                  {W.askForQuote}
                </a>
              </aside>
            )}
          </div>
        </section>
      )}

      {areas.length > 0 && (
        <section className="rv relative overflow-hidden bg-[color:var(--accent-2-soft)] py-14 lg:py-[72px]">
          <svg viewBox="0 0 200 200" aria-hidden="true" className="pointer-events-none absolute right-[-40px] top-1/2 w-[560px] max-w-[52%] -translate-y-1/2 text-[color:var(--accent-2)] opacity-[0.10]" fill="currentColor">
            <path d="M40 20l30 6 28-10 34 8 26 18-8 30 10 28-20 24-30 6-26-14-28 4-22-20 6-28-14-26 10-28z" />
          </svg>
          <div className="relative mx-auto grid max-w-[1120px] items-center gap-9 px-5 sm:px-6 lg:grid-cols-[1fr_1.25fr] lg:gap-12">
            <div>
              <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">
                <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
                {W.areasEyebrow}
              </div>
              <h2 className="mt-4 flex items-center gap-3 font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]">
                <MapPin size={28} weight="fill" className="text-accent" aria-hidden="true" />
                {W.areas}
              </h2>
              <a href={brand.phoneHref} className="mt-4 inline-flex items-center gap-2 font-heading text-[21px] font-semibold text-accent">
                <E p="brand.phone">{brand.phone}</E>
              </a>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-[10px]">
              {areas.map((x, k) => (
                <li key={x.i} className="shadow-brand-1 flex items-center gap-[7px] rounded-[10px] border border-rule bg-bg px-[15px] py-[10px] text-[14.5px] font-bold text-ink sm:text-[15px]">
                  {k === 0 && <MapPin size={14} weight="fill" className="text-accent" aria-hidden="true" />}
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
                <li key={x.i} className="shadow-brand-1 rounded-[10px] border border-rule bg-bg px-[18px] py-[11px] font-heading text-[17px] font-semibold tracking-[0.02em] text-ink">
                  <E p={`services.items.${n}.brands.${x.i}`}>{x.text}</E>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section id="questions" className="rv scroll-mt-20 bg-bg py-14 lg:py-20">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <div className="mx-auto max-w-[620px] text-center">
              <Cap center />
              <h2 className="font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]">{W.questions}</h2>
            </div>
            <div className="mx-auto mt-9 max-w-[760px] border-t border-rule">
              {questions.map((f, k) => (
                <details key={f.path} open={k === 0} className="group border-b border-rule">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-1 py-[22px] text-[16.5px] font-bold leading-[1.35] text-ink transition-colors group-open:text-[color:var(--accent-2)] [&::-webkit-details-marker]:hidden">
                    <E p={`${f.path}.q`}>{f.q}</E>
                    <Plus size={18} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
                  </summary>
                  <p className="max-w-[62ch] px-1 pb-[26px] text-[15.5px] leading-[1.72] text-inkSoft">
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
            <Cap />
            <div className={`grid items-stretch gap-[22px] ${review && photos.length ? 'lg:grid-cols-[1.35fr_1fr]' : photos.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {review && (
                <figure className="shadow-brand-1 relative flex flex-col justify-center rounded-[16px] border border-rule bg-bg p-7 lg:p-10">
                  <span className="pointer-events-none absolute right-[30px] top-[18px] font-heading text-[140px] font-semibold leading-[0.8] text-[color:var(--accent-2-soft)]" aria-hidden="true">&ldquo;</span>
                  <div className="relative tracking-[2px] text-[color:var(--star)]" aria-hidden="true">★★★★★</div>
                  <blockquote className="relative mt-5 max-w-[30ch] text-[clamp(20px,2vw,26px)] font-medium leading-[1.4] tracking-[-0.012em] text-ink">
                    <E p={`${review.path}.q`}>{review.q}</E>
                  </blockquote>
                  <figcaption className="mt-7 flex items-center gap-3">
                    <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full font-heading text-[21px] font-semibold text-onInk" style={{ background: 'var(--accent-bar)' }} aria-hidden="true">
                      {review.a.charAt(0)}
                    </span>
                    <span>
                      <b className="block text-[15px] font-semibold text-ink"><E p={`${review.path}.a`}>{review.a}</E></b>
                      {review.r && <small className="text-[13px] text-inkSoft">{review.r}</small>}
                    </span>
                  </figcaption>
                </figure>
              )}
              {photos.slice(0, review ? 1 : 3).map((ph) => (
                <figure key={ph.path} className="shadow-brand-1 flex flex-col overflow-hidden rounded-[16px] border border-rule bg-bg">
                  <div className="relative min-h-[220px] flex-1 bg-cover bg-center" style={{ backgroundImage: `url(${imageAt(ph.url, 1024)})` }} role="img" aria-label={ph.alt}>
                    <div className="absolute inset-0 bg-[color:var(--accent-2)] opacity-30 mix-blend-color" aria-hidden="true" />
                  </div>
                  {(ph.title || ph.meta) && (
                    <figcaption className="px-[22px] py-[18px]">
                      {ph.title && <b className="block font-heading text-[19px] font-semibold leading-[1.2] text-ink"><E p={`${ph.path}.t`}>{ph.title}</E></b>}
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
        <section className="rv bg-bg py-16 lg:py-[88px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <h2 className="font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]">{W.related}</h2>
            <ul className="rv-stagger mt-9 grid gap-[18px] lg:grid-cols-3">
              {related.map((r) => {
                const img = (r.item.image as { url?: string } | undefined)?.url;
                return (
                  <li key={r.slug}>
                    <a href={r.href!} className="group shadow-brand-1 flex items-center gap-4 rounded-[14px] border border-rule bg-bg p-4 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-[3px] hover:border-[color:var(--accent-2)] hover:shadow-brand-2">
                      {img && (
                        <span className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[10px] bg-cover bg-center" style={{ backgroundImage: `url(${imageAt(img, 640)})` }} aria-hidden="true">
                          <span className="absolute inset-0 bg-[color:var(--accent-2)] opacity-35 mix-blend-color" aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <b className="block font-heading text-[18px] font-semibold leading-[1.15] text-ink"><E p={`services.items.${r.index}.t`}>{r.t}</E></b>
                        {r.tag && <small className="mt-1.5 block text-[12px] font-bold uppercase tracking-[0.06em] text-accent">{r.tag}</small>}
                      </span>
                      <ArrowRight size={20} weight="bold" className="ml-auto shrink-0 text-[color:var(--accent-2)] transition-transform duration-300 group-hover:translate-x-[3px]" aria-hidden="true" />
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
