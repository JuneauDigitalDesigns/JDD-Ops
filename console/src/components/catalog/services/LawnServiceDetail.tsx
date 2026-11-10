'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnServiceDetail — the body of one per-service page (/services/<slug>), blocks 4–12 of
// service-page-spec.md §3, in the approved Lawn language (service-pages mockup, `.v-lawn`, Xander
// 2026-11-10): soft and airy, rounded everywhere. Every block renders ONE service's own content and
// is omitted when its data is absent (D5); no block is a site-wide section, so no two service pages
// share a body.
//   4  What's included        services.items[i].included        round soft ticks
//   5  Signs it's time to call services.items[i].typicalJobs     rounded card, sun-gold bar, 01/02 numbers
//   6  What to expect          services.items[i].page.expect     soft round step circles
//   7  Starting at             services.items[i].priceFrom       forest card, "/ visit" (Lawn's approved suffix)
//   8  Areas we serve          services.items[i].areas           the mow-stripe coverage band (LawnTrust's)
//   9  Brands we work with     services.items[i].brands
//   10 Common questions        tagged customer questions, then page.faq (3–5), rounded cards (LawnFaq's)
//   11 Proof                   reviews + job photos tagged to this service (never the main photo twice)
//   12 Related services        2–3 sibling services that have pages: LawnServices' photo cards, as links
// Block 13 is LawnFinalCta, which wirePages gives the same serviceSlug.
//
// Each block carries its own `rv` scroll reveal, so this component belongs in SELF_ANIMATED
// (revealPolicy.ts): a reveal on the whole body would fade a page-tall block. Edit paths use the
// ORIGINAL services.items index. Headings were approved word for word on 2026-11-10; "Coverage"
// and "/ visit" are the Lawn template's existing words. Every colour is a palette token: forest =
// ink-panel-2, sun gold = the editable accent2 slot, green tints = accent mixed into bg.
// ─────────────────────────────────────────────────────────────────────────────
import { Check, MapPin, Plus, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';
import { imageAt } from '@/lib/localImage';
import {
  relatedServices, serviceBySlug, serviceList, serviceProof, serviceQuestions,
} from '@/lib/serviceLinks';

export const meta = {
  id: 'lawn-service-detail',
  category: 'services',
  label: 'Lawn / Service page body',
  consumes: ['services.items', 'servicePages', 'testimonials.items', 'work.projects', 'extensions.customerQuestions', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/icons', '@/lib/localImage', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Approved word for word, 2026-11-10 ("Coverage" and "/ visit" are the Lawn template's own). */
export const SERVICE_PAGE_WORDS = {
  included: "What's included",
  signs: "Signs it's time to call",
  expect: 'What to expect',
  startingAt: 'Starting at',
  perVisit: '/ visit',
  askForQuote: 'Ask for a quote',
  areas: 'Areas we serve',
  areasEyebrow: 'Coverage',
  brands: 'Brands we work with',
  questions: 'Common questions',
  related: 'Related services',
  details: 'Details',
} as const;

const Cap = ({ center = false }: { center?: boolean }) => (
  <span className={`accent-bar mb-[18px] block !h-1 !w-11 !rounded-full ${center ? 'mx-auto' : ''}`} aria-hidden="true" />
);

const H2 = 'font-heading text-[30px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink lg:text-[36px]';

export default function LawnServiceDetail({ content = CONTENT, serviceSlug }: { content?: SiteContent; serviceSlug?: string }) {
  const s = serviceBySlug(content, serviceSlug);
  if (!s) return null;
  const W = SERVICE_PAGE_WORDS;
  const { brand, services } = content;
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
              <div className="relative rounded-[22px] bg-bgSoft px-[22px] pb-[18px] pt-[26px] shadow-[inset_0_0_0_1px_var(--rule)] lg:mt-[22px] lg:px-8 lg:pb-[22px] lg:pt-8">
                <span className="absolute bottom-8 left-0 top-8 w-1 rounded-r-[4px] bg-[color:var(--accent-2)]" aria-hidden="true" />
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
                      <span className="absolute left-0 top-[-6px] grid h-10 w-10 place-items-center rounded-full bg-[color:var(--accent-2-soft)] font-heading text-[17px] font-extrabold text-accent" aria-hidden="true">
                        {k + 1}
                      </span>
                      {k < expect.length - 1 && <span className="absolute bottom-0.5 left-[19px] top-[42px] w-0.5 rounded-full bg-rule" aria-hidden="true" />}
                      <E p={`services.items.${n}.page.expect.${x.i}`}>{x.text}</E>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {price && (
              <aside id="pricing" className="shadow-brand-3 relative scroll-mt-24 overflow-hidden rounded-[22px] bg-inkPanel2 p-7 text-onInk lg:p-8">
                <span className="accent-bar absolute inset-x-0 top-0 !h-1 !w-auto !rounded-none" aria-hidden="true" />
                <span className="block text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">{W.startingAt}</span>
                <b className="mt-3 flex flex-wrap items-baseline gap-2 font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] lg:text-[54px]">
                  <E p={`services.items.${n}.priceFrom`}>{price}</E>
                  <small className="font-sans text-[15px] font-semibold tracking-normal text-onInkSoft">{W.perVisit}</small>
                </b>
                <a
                  href="#cta"
                  className="mt-6 flex w-full items-center justify-center rounded-[14px] bg-accent px-[22px] py-[14px] text-[16px] font-bold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
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
        <section
          className="rv relative overflow-hidden py-14 lg:py-[92px]"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--accent) 12%, var(--bg))',
            backgroundImage:
              'repeating-linear-gradient(90deg, color-mix(in srgb, var(--accent) 6%, transparent) 0 46px, transparent 46px 92px)',
          }}
        >
          <div className="relative mx-auto grid max-w-[1120px] items-center gap-9 px-5 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-[52px]">
            <div>
              <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
                <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
                {W.areasEyebrow}
              </div>
              <h2 className={`mt-3.5 ${H2}`}>{W.areas}</h2>
              <a href={brand.phoneHref} className="mt-[18px] inline-flex items-center gap-2 font-heading text-[17px] font-extrabold text-accent">
                <E p="brand.phone">{brand.phone}</E>
              </a>
            </div>
            <ul className="flex flex-wrap gap-2 sm:gap-[10px]">
              {areas.map((x, k) => (
                <li
                  key={x.i}
                  className="shadow-brand-1 flex items-center gap-[7px] rounded-[14px] border border-rule bg-bg px-[15px] py-[10px] text-[14.5px] font-bold text-ink transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent sm:text-[15px]"
                >
                  {k === 0 && <MapPin size={14} weight="fill" className="shrink-0 text-accent" aria-hidden="true" />}
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
                <li key={x.i} className="rounded-[14px] border border-rule bg-bg px-[18px] py-[11px] font-heading text-[16px] font-extrabold leading-none tracking-[-0.01em] text-ink">
                  <E p={`services.items.${n}.brands.${x.i}`}>{x.text}</E>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section id="questions" className="rv scroll-mt-20 bg-bg py-14 lg:py-[92px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <div className="mx-auto max-w-[620px] text-center">
              <Cap center />
              <h2 className={H2}>{W.questions}</h2>
            </div>
            <div className="mx-auto mt-9 max-w-[800px]">
              {questions.map((f, k) => (
                <details
                  key={f.path}
                  open={k === 0}
                  className="group mt-[11px] overflow-hidden rounded-[20px] border border-rule bg-bg transition-colors duration-300 open:border-[color:color-mix(in_srgb,var(--accent)_30%,var(--rule))] open:bg-bgSoft"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-[16.5px] font-bold leading-[1.3] tracking-[-0.012em] text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
                    <E p={`${f.path}.q`}>{f.q}</E>
                    <Plus size={18} weight="bold" className="shrink-0 text-accent transition-transform duration-300 group-open:rotate-45" aria-hidden="true" />
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
          <div className={`mx-auto grid max-w-[1120px] items-stretch gap-4 px-5 sm:px-6 lg:gap-[22px] ${review && photos.length ? 'lg:grid-cols-[1.35fr_1fr]' : photos.length > 1 ? 'sm:grid-cols-2' : ''}`}>
            {review && (
              <figure className="shadow-brand-1 relative flex flex-col justify-center rounded-[22px] border border-rule bg-bg p-7 lg:p-10">
                <span
                  className="pointer-events-none absolute right-7 top-4 font-heading text-[140px] font-extrabold leading-[0.8]"
                  style={{ color: 'color-mix(in srgb, var(--accent) 12%, var(--bg))' }}
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
                <div className="relative text-[15px] tracking-[2px] text-[color:var(--star)]" aria-hidden="true">★★★★★</div>
                <blockquote className="relative mt-5 max-w-[30ch] text-[22px] font-medium leading-[1.35] tracking-[-0.012em] text-ink lg:text-[clamp(22px,2.2vw,28px)]">
                  <E p={`${review.path}.q`}>{review.q}</E>
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-3">
                  <span
                    className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full font-heading text-[21px] font-extrabold text-[color:var(--accent-2-fg)]"
                    style={{ background: 'var(--accent-bar)' }}
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
              <figure key={ph.path} className="shadow-brand-1 flex flex-col overflow-hidden rounded-[22px] border border-rule bg-bg">
                <div className="relative min-h-[220px] flex-1 bg-cover bg-center" style={{ backgroundImage: `url(${imageAt(ph.url, 1024)})` }} role="img" aria-label={ph.alt}>
                  <div className="absolute inset-0 bg-inkPanel2 opacity-35 mix-blend-color" aria-hidden="true" />
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
        </section>
      )}

      {related.length > 0 && (
        <section className="rv bg-bg py-16 lg:py-24">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <h2 className={H2}>{W.related}</h2>
            <ul className="rv-stagger mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-[22px]">
              {related.map((r) => {
                const item = services.items[r.index];
                const photo = item?.image?.url;
                const tile = (
                  <span
                    className={`grid h-14 w-14 place-items-center rounded-[15px] border border-rule text-accent transition-colors duration-300 group-hover:border-accent group-hover:bg-accent group-hover:text-accentFg ${
                      photo ? 'shadow-brand-1 absolute bottom-[-24px] left-[22px] z-[1] bg-bg' : 'mb-[18px]'
                    }`}
                    style={photo ? undefined : { background: 'color-mix(in srgb, var(--accent) 12%, var(--bg))' }}
                  >
                    <Ico p={`services.items.${r.index}.icon`} icon={serviceIcon(item?.icon, item?.tag)} size={26} />
                  </span>
                );
                return (
                  <li key={r.slug} className="flex">
                    <a
                      href={r.href!}
                      className="group hover-lift shadow-brand-1 flex w-full flex-col overflow-hidden rounded-[22px] border border-rule bg-bg hover:shadow-brand-3"
                    >
                      {photo && (
                        <span
                          className="relative block aspect-[16/9] bg-cover bg-center"
                          style={{ backgroundImage: `url(${imageAt(photo, 1024)})` }}
                          role="img"
                          aria-label={item?.image?.alt ?? r.t}
                        >
                          <span className="absolute inset-0 bg-inkPanel2 opacity-35 mix-blend-color" aria-hidden="true" />
                          {tile}
                        </span>
                      )}
                      <span className={`flex flex-1 flex-col px-5 pb-5 lg:px-[26px] lg:pb-6 ${photo ? 'pt-10' : 'pt-[26px]'}`}>
                        {!photo && tile}
                        <b className="block font-heading text-[22px] font-extrabold tracking-[-0.02em] text-ink">
                          <E p={`services.items.${r.index}.t`}>{r.t}</E>
                        </b>
                        {item?.d?.trim() && (
                          <span className="mt-3 block text-[15.5px] leading-[1.6] text-inkSoft">
                            <E p={`services.items.${r.index}.d`}>{item.d}</E>
                          </span>
                        )}
                        <span className="mt-auto block pt-[18px]">
                          <span className="flex items-center gap-2 border-t border-rule pt-[18px] text-[13px] font-bold uppercase tracking-[0.04em] text-accent">
                            {r.tag && <E p={`services.items.${r.index}.tag`}>{r.tag}</E>}
                            <span className="ml-auto flex items-center gap-1.5 text-[14px] normal-case tracking-normal">
                              {W.details}
                              <ArrowRight size={16} weight="bold" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-[3px]" />
                            </span>
                          </span>
                        </span>
                      </span>
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
