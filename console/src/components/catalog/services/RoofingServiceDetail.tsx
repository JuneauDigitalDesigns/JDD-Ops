'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingServiceDetail — the body of one per-service page (/services/<slug>), blocks 4–12 of
// service-page-spec.md §3, in the approved Roofing language (service-pages mockup, `roofing`,
// Xander 2026-11-10): square and structural, roofing's 4px/6px corners throughout. Every block
// renders ONE service's own content and is omitted when its data is absent (D5); no block is a
// site-wide section, so no two service pages share a body.
//   4  What's included        services.items[i].included        square, accent-filled ticks
//   5  Signs it's time to call services.items[i].typicalJobs     outlined (stroked) numerals
//   6  What to expect          services.items[i].page.expect     square numbered steps
//   7  Starting at             services.items[i].priceFrom       dark panel, "Ask for a quote" → the form
//   8  Areas we serve          services.items[i].areas           the hairline town index (own towns only)
//   9  Brands we work with     services.items[i].brands
//   10 Common questions        tagged customer questions, then page.faq (3–5), two-column rows
//   11 Proof                   the pull quote beside the job photo (never the main photo twice)
//   12 Related services        2–3 sibling services that have pages, as the home's numbered rows
// Block 13 is RoofingFinalCta, which wirePages gives the same serviceSlug.
//
// Each block carries its own `rv` scroll reveal, so this component is in SELF_ANIMATED
// (revealPolicy.ts): a reveal on the whole body would fade a page-tall block. Edit paths use the
// ORIGINAL services.items index. Headings were approved word for word on 2026-11-10.
//
// Colours are palette tokens: the emphasis colour (signs bar, price label, stars) is
// var(--accent-2), the editable accent2 slot; ticks, steps and numerals are accent; the resting
// numeral stroke is the same ink-soft/bg mix RoofingServices uses.
// ─────────────────────────────────────────────────────────────────────────────
import { Check, Plus } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { imageAt } from '@/lib/localImage';
import {
  relatedServices, serviceBySlug, serviceList, serviceProof, serviceQuestions, serviceRefs,
} from '@/lib/serviceLinks';

export const meta = {
  id: 'roofing-service-detail',
  category: 'services',
  label: 'Roofing / Service page body',
  consumes: ['services.items', 'servicePages', 'testimonials.items', 'work.projects', 'extensions.customerQuestions'],
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

/** The square accent-bar cap over a section heading (roofing's hard edge, no rounding). */
const Cap = () => <span className="accent-bar mb-[18px] block !h-1 !w-11 !rounded-none" aria-hidden="true" />;

const H2_LG = 'font-heading text-[clamp(34px,4vw,46px)] font-extrabold leading-[1.02] tracking-[-0.024em] text-ink';
const H2_MD = 'font-heading text-[clamp(30px,3.2vw,36px)] font-extrabold leading-[1.02] tracking-[-0.024em] text-ink';
const pad2 = (k: number) => String(k + 1).padStart(2, '0');

export default function RoofingServiceDetail({ content = CONTENT, serviceSlug }: { content?: SiteContent; serviceSlug?: string }) {
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
  // A related row shows the same numeral its service has on the home's ruled rows.
  const order = serviceRefs(content);
  const numeral = (index: number, item: Record<string, unknown>) => {
    const own = typeof item.n === 'string' ? item.n.trim() : '';
    return own || pad2(order.findIndex((o) => o.index === index));
  };

  return (
    <>
      {(included.length > 0 || jobs.length > 0) && (
        <section className="rv bg-bg py-16 lg:py-[92px]">
          <div className={`mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:gap-14 ${included.length && jobs.length ? 'lg:grid-cols-2' : ''}`}>
            {included.length > 0 && (
              <div>
                <Cap />
                <h2 className={H2_LG}>{W.included}</h2>
                <ul className="mt-[26px] border-t border-rule">
                  {included.map((x) => (
                    <li key={x.i} className="flex items-start gap-3.5 border-b border-rule py-4 text-[16px] font-semibold leading-[1.45] text-ink">
                      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center bg-accent text-accentFg">
                        <Check size={15} weight="bold" aria-hidden="true" />
                      </span>
                      <E p={`services.items.${n}.included.${x.i}`}>{x.text}</E>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {jobs.length > 0 && (
              <div className="relative rounded-[6px] bg-bgSoft px-[22px] pb-[18px] pt-[26px] shadow-[inset_0_0_0_1px_var(--rule)] lg:mt-[22px] lg:px-8 lg:pb-[22px] lg:pt-8">
                <span className="absolute bottom-8 left-0 top-8 w-1 bg-[color:var(--accent-2)]" aria-hidden="true" />
                <h2 className={H2_MD}>{W.signs}</h2>
                <ol className="mt-[18px]">
                  {jobs.map((x, k) => (
                    <li key={x.i} className={`flex items-baseline gap-4 py-[13px] text-[16px] leading-[1.5] text-ink ${k ? 'border-t border-rule' : ''}`}>
                      <span
                        className="w-[34px] shrink-0 font-heading text-[24px] font-extrabold leading-none tracking-[-0.02em] text-transparent"
                        style={{ WebkitTextStrokeWidth: '1.2px', WebkitTextStrokeColor: 'var(--accent)' }}
                        aria-hidden="true"
                      >
                        {pad2(k)}
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
                <h2 className={H2_MD}>{W.expect}</h2>
                <ol className="mt-7">
                  {expect.map((x, k) => (
                    <li key={x.i} className="relative pb-[26px] pl-[60px] text-[16.5px] leading-[1.55] text-ink last:pb-0">
                      <span className="absolute left-0 top-[-6px] grid h-10 w-10 place-items-center rounded-[4px] bg-accent font-heading text-[17px] font-extrabold text-accentFg" aria-hidden="true">
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
              <aside id="pricing" className="shadow-brand-3 relative scroll-mt-24 overflow-hidden rounded-[6px] bg-inkPanel2 p-8 text-onInk">
                <span className="accent-bar absolute inset-x-0 top-0 !h-1 !w-auto !rounded-none" aria-hidden="true" />
                <span className="block text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">{W.startingAt}</span>
                <b className="mt-3 block font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] lg:text-[54px]">
                  <E p={`services.items.${n}.priceFrom`}>{price}</E>
                </b>
                <a
                  href="#cta"
                  className="mt-6 flex w-full items-center justify-center rounded-[4px] bg-accent px-[22px] py-[14px] text-[16px] font-extrabold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
                  style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
                >
                  {W.askForQuote}
                </a>
              </aside>
            )}
          </div>
        </section>
      )}

      {areas.length > 0 && (
        <section className="rv relative overflow-hidden border-t border-rule bg-bgSoft py-14 lg:py-[88px]">
          {/* Pitched-roof watermark, bottom-right (the home coverage section's mark). */}
          <svg viewBox="0 0 200 140" fill="currentColor" className="pointer-events-none absolute bottom-[-30px] right-[-60px] w-[520px] max-w-[48%] text-inkPanel2 opacity-[0.07]" aria-hidden="true">
            <path d="M0 90L60 30l60 60V140H0zM110 90l45-42 45 42v50h-90z" />
          </svg>
          <div className="relative mx-auto max-w-[1120px] px-5 sm:px-6">
            <div className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
              <span className="accent-bar !h-[3px] !w-7 !rounded-[2px]" aria-hidden="true" />
              {W.areasEyebrow}
            </div>
            <h2 className={`mt-4 ${H2_MD}`}>{W.areas}</h2>
            <ul className="mt-8 grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:mt-10 lg:grid-cols-4 lg:gap-x-9">
              {areas.map((x) => (
                <li key={x.i} className="flex min-w-0 items-center gap-2.5 border-b border-rule py-[13px] text-[15.5px] font-semibold leading-[1.2] text-ink transition-colors hover:text-accent">
                  <span className="h-1.5 w-1.5 shrink-0 bg-accent" aria-hidden="true" />
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
                <li key={x.i} className="rounded-[4px] border border-rule bg-bg px-[18px] py-[11px] font-heading text-[16px] font-extrabold leading-none tracking-[-0.01em] text-ink">
                  <E p={`services.items.${n}.brands.${x.i}`}>{x.text}</E>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section id="questions" className="rv scroll-mt-20 bg-bg py-14 lg:py-[88px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <div className="max-w-[52ch]">
              <Cap />
              <h2 className={H2_MD}>{W.questions}</h2>
            </div>
            <div className="mt-10 grid gap-x-12 md:grid-cols-2">
              {questions.map((f, k) => (
                <details key={f.path} open={k === 0} className="group border-b border-rule">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-bold leading-[1.3] tracking-[-0.01em] text-ink transition-colors hover:text-accent group-open:text-accent [&::-webkit-details-marker]:hidden">
                    <E p={`${f.path}.q`}>{f.q}</E>
                    <Plus size={17} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
                  </summary>
                  <p className="max-w-[46ch] pb-[22px] text-[15px] leading-[1.7] text-inkSoft">
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
          <div className={`mx-auto grid max-w-[1120px] items-stretch gap-[22px] px-5 sm:px-6 ${review && photos.length ? 'lg:grid-cols-[1.35fr_1fr] lg:gap-10' : photos.length > 1 ? 'sm:grid-cols-2' : ''}`}>
            {review && (
              <figure className="max-w-[60ch] self-center border-l-[3px] border-accent py-1 pl-[26px]">
                <div className="text-[14px] tracking-[2px] text-[color:var(--accent-2)]" aria-hidden="true">★★★★★</div>
                <blockquote className="mt-3 font-heading text-[clamp(19px,1.8vw,22px)] font-medium leading-[1.5] tracking-[-0.012em] text-ink">
                  <E p={`${review.path}.q`}>{review.q}</E>
                </blockquote>
                {(review.a || review.r) && (
                  <figcaption className="mt-3.5 text-[13.5px] font-semibold leading-[1.4] text-inkSoft">
                    {review.a && <b className="text-ink"><E p={`${review.path}.a`}>{review.a}</E></b>}
                    {review.a && review.r && ' · '}
                    {review.r}
                  </figcaption>
                )}
              </figure>
            )}
            {photos.slice(0, review ? 1 : 3).map((ph) => (
              <figure key={ph.path} className="shadow-brand-1 flex flex-col overflow-hidden rounded-[6px] border border-rule bg-bg">
                <div className="min-h-[220px] flex-1 bg-cover bg-center" style={{ backgroundImage: `url(${imageAt(ph.url, 1024)})` }} role="img" aria-label={ph.alt} />
                {(ph.title || ph.meta) && (
                  <figcaption className="px-[22px] py-[18px]">
                    {ph.title && <b className="block font-heading text-[18px] font-extrabold leading-[1.2] tracking-[-0.01em] text-ink"><E p={`${ph.path}.t`}>{ph.title}</E></b>}
                    {ph.meta && <small className="mt-1 block text-[13.5px] text-inkSoft">{ph.meta}</small>}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="rv bg-bg py-16 lg:py-[96px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <h2 className={H2_MD}>{W.related}</h2>
            <ul className="rv-stagger mt-8 border-t border-rule">
              {related.map((r) => {
                const d = typeof r.item.d === 'string' ? r.item.d.trim() : '';
                return (
                  <li key={r.slug}>
                    <a
                      href={r.href!}
                      className="group grid grid-cols-[56px_1fr] items-start gap-x-4 border-b border-rule px-1 py-[22px] transition-[background-color,padding] duration-300 [--rf-stroke:color-mix(in_srgb,var(--ink-soft)_70%,var(--bg))] hover:bg-bgSoft hover:[--rf-stroke:var(--accent)] md:grid-cols-[96px_1fr_1.25fr_40px] md:gap-6 md:px-3 md:py-[30px] md:hover:pl-5"
                    >
                      <span
                        className="font-heading text-[32px] font-extrabold leading-[0.9] tracking-[-0.04em] text-transparent md:text-[44px]"
                        style={{ WebkitTextStrokeWidth: '1.5px', WebkitTextStrokeColor: 'var(--rf-stroke)', transition: '-webkit-text-stroke-color .3s' }}
                        aria-hidden="true"
                      >
                        {numeral(r.index, r.item)}
                      </span>
                      <span className="min-w-0">
                        <b className="block font-heading text-[21px] font-extrabold leading-[1.1] tracking-[-0.024em] text-ink md:text-[24px]">
                          <E p={`services.items.${r.index}.t`}>{r.t}</E>
                        </b>
                        {r.tag && (
                          <span className="mt-2 block text-[11.5px] font-bold uppercase tracking-[0.12em] text-accent">
                            <E p={`services.items.${r.index}.tag`}>{r.tag}</E>
                          </span>
                        )}
                      </span>
                      {d && (
                        <span className="col-start-2 mt-2.5 block text-[15px] leading-[1.62] text-inkSoft md:col-start-auto md:mt-0 md:pt-1 md:text-[15.5px]">
                          <E p={`services.items.${r.index}.d`}>{d}</E>
                        </span>
                      )}
                      <svg
                        className="hidden shrink-0 md:col-start-4 justify-self-end pt-2 text-[color:var(--rf-stroke)] transition-[color,transform] duration-300 group-hover:translate-x-1.5 md:block"
                        width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                        aria-hidden="true"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
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
