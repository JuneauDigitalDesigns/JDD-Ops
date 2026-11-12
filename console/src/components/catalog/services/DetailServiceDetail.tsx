'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailServiceDetail — the body of one per-service page (/services/<slug>), blocks 4–12 of
// service-page-spec.md §3, in the approved Car Detailing language (service-pages mockup, `.v-detail`
// overrides, Xander 2026-11-10): dark glass panels, gold for the ticks, the steps and the price.
// Same data, omission rules and edit paths as HvacServiceDetail; only the idiom differs.
//   4  What's included        services.items[i].included        (client)       hairline list, gold-ringed ticks
//   5  Signs it's time to call services.items[i].typicalJobs     (client)       glass panel, gold bar, 01 02 03
//   6  What to expect          services.items[i].page.expect     (generated)    gold numbered steps
//   7  Starting at             services.items[i].priceFrom       ("Ask for a quote" → the form)  glass price card
//   8  Areas we serve          services.items[i].areas           (own towns only)  ringed band, gold-dotted towns
//   9  Brands we work with     services.items[i].brands          outlined chips
//   10 Common questions        tagged customer questions, then page.faq (3–5)    hairline rows on the slate band
//   11 Proof                   reviews + job photos tagged to this service      glass quote card beside the job photo
//   12 Related services        2–3 sibling services that have pages, same tag first   glass package cards
// Block 13 is DetailFinalCta, the template's one light band, which wirePages gives the same
// serviceSlug.
//
// Each block carries its own `rv` scroll reveal, so this component is in SELF_ANIMATED
// (revealPolicy.ts): a reveal on the whole body would fade a page-tall block. Edit paths use the
// ORIGINAL services.items index. Headings were approved word for word on 2026-11-10; "Service
// area" and "starting at" are the words DetailTrust and DetailServices already use.
//
// Every colour is a palette token: glass is ink at 4% / 9% over the ground (DetailServices'
// cards), the gold bar and mark are the accent pulled toward black, and the questions band is bg
// mixed toward ink (DetailFaq: this palette's --ink-panel-2 is accent-tinted and hides the rules).
// ─────────────────────────────────────────────────────────────────────────────
import { Check, Plus } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';
import { CoverImage } from '@/lib/CoverImage';
import {
  relatedServices, serviceBySlug, serviceList, serviceProof, serviceQuestions,
} from '@/lib/serviceLinks';

export const meta = {
  id: 'detail-service-detail',
  category: 'services',
  label: 'Car Detailing / Service page body',
  consumes: ['services.items', 'servicePages', 'testimonials.items', 'work.projects', 'extensions.customerQuestions'],
  sharedDeps: ['@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable', '@/lib/icons', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Approved word for word, 2026-11-10 ("Service area" and "starting at" are this template's own). */
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
  priceNote: 'starting at',
} as const;

const DARK_GOLD = 'color-mix(in srgb, var(--accent) 65%, black)';
const GOLD_BAR = `linear-gradient(90deg, var(--accent), ${DARK_GOLD} 60%, transparent)`;
const GOLD_MARK = `linear-gradient(145deg, var(--accent), ${DARK_GOLD})`;
/** Glass: ink at 4% over the ground, with a 9% ink hairline (DetailServices' package cards). */
const GLASS = 'border border-[color:color-mix(in_srgb,var(--ink)_9%,transparent)] bg-[color:color-mix(in_srgb,var(--ink)_4%,transparent)]';
const HAIR = 'border-[color:color-mix(in_srgb,var(--ink)_9%,transparent)]';

const Cap = ({ center = false }: { center?: boolean }) => (
  <span className={`mb-[18px] block h-1 w-11 rounded-full ${center ? 'mx-auto' : ''}`} style={{ background: GOLD_BAR }} aria-hidden="true" />
);
const H2 = 'font-heading text-[30px] font-extrabold leading-[1.04] tracking-[-0.016em] text-ink lg:text-[36px]';
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export default function DetailServiceDetail({ content = CONTENT, serviceSlug }: { content?: SiteContent; serviceSlug?: string }) {
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
                <h2 className="font-heading text-[34px] font-extrabold leading-[1.04] tracking-[-0.016em] text-ink lg:text-[46px]">{W.included}</h2>
                <ul className="mt-[26px] border-t border-rule">
                  {included.map((x) => (
                    <li key={x.i} className="flex items-start gap-3.5 border-b border-rule py-4 text-[16px] font-semibold leading-[1.45] text-ink">
                      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_45%,transparent)]">
                        <Check size={15} weight="bold" aria-hidden="true" />
                      </span>
                      <E p={`services.items.${n}.included.${x.i}`}>{x.text}</E>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {jobs.length > 0 && (
              <div className="relative rounded-[12px] bg-[color:color-mix(in_srgb,var(--ink)_3.5%,transparent)] px-[22px] pb-[18px] pt-[26px] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_8.5%,transparent)] sm:px-8 sm:pb-[22px] sm:pt-8 lg:mt-[22px]">
                <span className="absolute bottom-8 left-0 top-8 w-1 rounded-r-[4px] bg-accent" aria-hidden="true" />
                <h2 className={H2}>{W.signs}</h2>
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
                <h2 className={H2}>{W.expect}</h2>
                <ol className="mt-7">
                  {expect.map((x, k) => (
                    <li key={x.i} className="relative pb-[26px] pl-[60px] text-[16.5px] leading-[1.55] text-ink last:pb-0">
                      <span className="absolute left-0 top-[-6px] grid h-10 w-10 place-items-center rounded-[8px] bg-accent font-heading text-[17px] font-extrabold text-accentFg" aria-hidden="true">
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
                className="relative scroll-mt-24 overflow-hidden rounded-[12px] bg-[color:color-mix(in_srgb,var(--ink)_3.5%,transparent)] p-7 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)] sm:p-8"
              >
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: GOLD_BAR }} aria-hidden="true" />
                <span className="block text-[12px] font-bold uppercase leading-none tracking-[0.14em] text-accent">{W.startingAt}</span>
                <b className="mt-3 block font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] text-ink lg:text-[54px]">
                  <E p={`services.items.${n}.priceFrom`}>{price}</E>
                </b>
                <a
                  href="#cta"
                  className="mt-6 flex w-full items-center justify-center rounded-[8px] bg-accent px-[22px] py-[14px] font-heading text-[16px] font-extrabold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
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
        <section className="rv relative overflow-hidden bg-bgSoft py-14 text-center sm:py-[92px]">
          <svg
            viewBox="0 0 400 400"
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 w-[760px] max-w-[120%] -translate-x-1/2 -translate-y-1/2 text-accent opacity-[0.13]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <circle cx="200" cy="200" r="70" />
            <circle cx="200" cy="200" r="118" />
            <circle cx="200" cy="200" r="166" />
            <circle cx="200" cy="200" r="198" />
          </svg>
          <div className="relative mx-auto max-w-[760px] px-5 sm:px-6">
            <div className="flex items-center justify-center gap-2.5 text-[11.5px] font-semibold uppercase leading-none tracking-[0.26em] text-accent">
              <span className="h-[3px] w-7 shrink-0 rounded-sm" style={{ background: GOLD_BAR }} aria-hidden="true" />
              {W.areasEyebrow}
            </div>
            <h2 className="mt-4 font-heading text-[clamp(30px,3.6vw,42px)] font-extrabold leading-[1.04] tracking-[-0.016em] text-ink">{W.areas}</h2>
            <ul className="mt-[30px] flex flex-wrap items-center justify-center gap-y-2.5">
              {areas.map((x, k) => (
                <li key={x.i} className="flex items-center">
                  {k > 0 && <span className="mx-4 h-[5px] w-[5px] shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                  <span className="text-[14.5px] font-semibold leading-none text-inkSoft">
                    <E p={`services.items.${n}.areas.${x.i}`}>{x.text}</E>
                  </span>
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
                <li key={x.i} className="rounded-[8px] border border-rule px-[18px] py-[11px] font-heading text-[16px] font-extrabold leading-none tracking-[-0.01em] text-ink">
                  <E p={`services.items.${n}.brands.${x.i}`}>{x.text}</E>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section
          id="questions"
          className="rv scroll-mt-20 py-14 sm:py-[92px]"
          style={{ background: 'color-mix(in srgb, var(--bg) 93%, var(--ink))' }}
        >
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <div className="mx-auto max-w-[620px] text-center">
              <Cap center />
              <h2 className={H2}>{W.questions}</h2>
            </div>
            <div className="mx-auto mt-10 max-w-[820px] border-t border-rule">
              {questions.map((f, k) => (
                <details key={f.path} open={k === 0} className="group border-b border-rule">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-[18px] px-1 py-6 text-[16.5px] font-bold leading-[1.3] text-ink transition-colors duration-200 hover:text-accent group-open:text-accent [&::-webkit-details-marker]:hidden">
                    <E p={`${f.path}.q`}>{f.q}</E>
                    <Plus size={18} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
                  </summary>
                  <p className="max-w-[62ch] px-1 pb-[26px] text-[15.5px] leading-[1.75] text-inkSoft">
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
                <figure className={`flex flex-col rounded-[12px] p-6 sm:p-7 lg:p-10 ${GLASS}`}>
                  <div className="text-[17px] tracking-[3px] text-accent" aria-hidden="true">★★★★★</div>
                  <blockquote className="mt-4 flex-1 font-heading text-[18px] font-medium leading-[1.55] tracking-[-0.012em] text-ink sm:text-[19px]">
                    <E p={`${review.path}.q`}>{review.q}</E>
                  </blockquote>
                  <figcaption className={`mt-6 flex items-center gap-[13px] border-t pt-5 ${HAIR}`}>
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-heading text-[18px] font-extrabold text-accentFg"
                      style={{ background: GOLD_MARK }}
                      aria-hidden="true"
                    >
                      {review.a.charAt(0).toUpperCase()}
                    </span>
                    <span>
                      <b className="block text-[14.5px] font-semibold leading-[1.2] text-ink"><E p={`${review.path}.a`}>{review.a}</E></b>
                      {review.r && <small className="text-[12.5px] text-inkSoft">{review.r}</small>}
                    </span>
                  </figcaption>
                </figure>
              )}
              {photos.slice(0, review ? 1 : 3).map((ph) => (
                <figure key={ph.path} className={`flex flex-col overflow-hidden rounded-[12px] ${GLASS}`}>
                  <div
                    className="relative min-h-[220px] flex-1 isolate overflow-hidden"
                    style={{ filter: 'saturate(.82) contrast(1.06)' }}
                  >
                    <CoverImage url={ph.url} alt={ph.alt} sizes="(min-width: 1024px) 50vw, 100vw" />
                  </div>
                  {(ph.title || ph.meta) && (
                    <figcaption className="px-[22px] py-[18px]">
                      {ph.title && <b className="block font-heading text-[18px] font-extrabold leading-[1.2] tracking-[-0.016em] text-ink"><E p={`${ph.path}.t`}>{ph.title}</E></b>}
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
        <section className="rv bg-bg py-16 sm:py-24">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <h2 className={H2}>{W.related}</h2>
            <ul className="rv-stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-[22px]">
              {related.map((r) => {
                const d = str(r.item.d);
                const from = str(r.item.priceFrom);
                return (
                  <li key={r.slug} className="flex">
                    <a
                      href={r.href!}
                      className={`group flex w-full flex-col rounded-[12px] p-6 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-[3px] hover:border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--ink)_6%,transparent)] sm:p-7 ${GLASS}`}
                    >
                      <span className="mb-5 grid h-[44px] w-[44px] place-items-center rounded-[10px] border border-[color:color-mix(in_srgb,var(--accent)_40%,transparent)] text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-accentFg">
                        <Ico p={`services.items.${r.index}.icon`} icon={serviceIcon(str(r.item.icon) || undefined, r.tag || undefined)} size={21} />
                      </span>
                      <b className="block font-heading text-[20px] font-extrabold leading-[1.2] tracking-[-0.016em] text-ink">
                        <E p={`services.items.${r.index}.t`}>{r.t}</E>
                      </b>
                      {d && (
                        <span className="mt-2.5 block text-[14.5px] leading-[1.65] text-inkSoft">
                          <E p={`services.items.${r.index}.d`}>{d}</E>
                        </span>
                      )}
                      {(from || r.tag) && (
                        <span className="mt-auto block pt-5">
                        <span className={`flex items-baseline justify-between gap-3 border-t pt-5 ${HAIR}`}>
                          {from ? (
                            <span className="font-heading text-[20px] font-extrabold leading-none tracking-[-0.02em] text-ink">
                              <E p={`services.items.${r.index}.priceFrom`}>{from}</E>
                              <small
                                className="mt-1 block font-sans text-[11px] font-semibold uppercase leading-none tracking-[0.14em]"
                                style={{ color: 'color-mix(in srgb, var(--ink-soft) 70%, var(--bg))' }}
                              >
                                {W.priceNote}
                              </small>
                            </span>
                          ) : (
                            <span />
                          )}
                          {r.tag && (
                            <span className="text-[10.5px] font-bold uppercase leading-none tracking-[0.17em] text-accent">
                              <E p={`services.items.${r.index}.tag`}>{r.tag}</E>
                            </span>
                          )}
                        </span>
                        </span>
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
