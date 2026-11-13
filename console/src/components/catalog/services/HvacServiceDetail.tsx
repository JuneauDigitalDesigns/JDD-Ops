'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacServiceDetail — the body of one per-service page (/services/<slug>), blocks 4–12 of
// service-page-spec.md §3, in the approved HVAC language (service-pages mockup v6, Xander
// 2026-11-10). Every block renders ONE service's own content and is omitted when its data is
// absent (D5); no block is a site-wide section, so no two service pages share a body.
// Upgraded 2026-11-11 (Xander approved the mockup "HVAC Service Page Upgrade"): the price moved
// into the header, the job photos lead, and the page carries generated explanation for search.
//   Our work                  job photos tagged to this service (client photos only, never stock)
//   About {service}           services.items[i].page.body       (generated: facts + general trade knowledge)
//   Know before you book      duration, areas, brands (service's own, else site-wide); only rows given
//   What's included           included[] + page.includedNotes   (cards, staggered reveal: motion 1)
//   Signs it's time to call   typicalJobs[] + page.signNotes    (navy band, ring per sign: motion 2)
//   What to expect            services.items[i].page.expect     (generated from stated facts)
//   Areas we serve            services.items[i].areas           (own towns only, hidden if none)
//   Common questions          tagged customer questions, then page.faq (3–5)
//   Proof                     a review tagged to this service
//   Related services          2–3 sibling services that have pages, same tag first
// "Starting at" and "Ask for a quote" are in HvacServiceHeader now.
// Block 13 is the vertical's own final CTA, which wirePages gives the same serviceSlug.
//
// Each block carries its own `rv` scroll reveal, so this component is in SELF_ANIMATED
// (revealPolicy.ts): a reveal on the whole body would fade a page-tall block. Edit paths use the
// ORIGINAL services.items index. Headings were approved word for word on 2026-11-10.
// ─────────────────────────────────────────────────────────────────────────────
import { Check, MapPin, Plus, ArrowRight, Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { ServiceNearbyTowns, ServicePriceFactors, type ServiceBlockLook } from '@/lib/TownPage';
import { E } from '@/lib/editable';
import { CoverImage } from '@/lib/CoverImage';
import { WorkCarousel } from '@/lib/PhotoCarousel';
import {
  primaryCity, relatedServices, serviceBySlug, serviceList, serviceProof, serviceQuestions,
} from '@/lib/serviceLinks';
import {
  SERVICE_UPGRADE_WORDS, aboutParagraphs, listWithNotes, ourWorkPhotos, serviceFacts,
} from '@/lib/servicePage';

export const meta = {
  id: 'hvac-service-detail',
  category: 'services',
  label: 'HVAC / Service page body',
  consumes: ['services.items', 'servicePages', 'areaPages', 'testimonials.items', 'work.projects', 'extensions.customerQuestions', 'extensions.brandsCarried', 'brand.address', 'extensions.serviceArea', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['@/lib/TownPage', '@/lib/townLinks', '@/lib/PhotoCarousel', '@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable', '@/lib/serviceLinks', '@/lib/servicePage'],
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

/** How this trade draws the two town-era blocks (lib/TownPage.tsx; approved 2026-11-12). */
const blockLook = (band: string): ServiceBlockLook => ({
  cap: <Cap />,
  h2: 'font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]',
  band,
  card: 'shadow-brand-1 rounded-[14px] border border-rule bg-bg',
  link: 'text-[color:var(--accent-2)]',
});

export default function HvacServiceDetail({ content = CONTENT, serviceSlug }: { content?: SiteContent; serviceSlug?: string }) {
  const s = serviceBySlug(content, serviceSlug);
  if (!s) return null;
  const W = SERVICE_PAGE_WORDS;
  const { brand } = content;
  const n = s.index;
  const U = SERVICE_UPGRADE_WORDS;
  const city = primaryCity(content);
  // The photos' alt is the page's own heading, "{service} in {city}": facts, never a guess.
  const headline = city ? `${s.t} in ${city}` : s.t;
  const work = ourWorkPhotos(content, s);
  const about = aboutParagraphs(s);
  const facts = serviceFacts(content, s, { howLong: U.howLong, areas: W.areas, brands: W.brands });
  const included = listWithNotes(s, 'included');
  const signs = listWithNotes(s, 'typicalJobs');
  const expect = (Array.isArray((s.item.page as { expect?: unknown } | undefined)?.expect)
    ? ((s.item.page as { expect: unknown[] }).expect)
    : []
  )
    .map((v, i) => ({ text: typeof v === 'string' ? v.trim() : '', i }))
    .filter((x) => x.text);
  const areas = serviceList(s, 'areas');
  const questions = serviceQuestions(content, s);
  const { reviews } = serviceProof(content, s);
  const related = relatedServices(content, s);
  const review = reviews[0];

  return (
    <>
      {work.length > 0 && (
        <section className="rv bg-bg pb-4 pt-14 lg:pt-20">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <h2 className="font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]">{U.ourWork}</h2>
            <div className="mt-7">
              <WorkCarousel
                photos={work.map((ph) => ({ url: ph.url, alt: headline }))}
                frame={`shadow-brand-2 rounded-[16px] bg-bgSoft`}
                aspect="aspect-[3/2] lg:aspect-[16/9]"
              />
            </div>
          </div>
        </section>
      )}

      {(about.length > 0 || facts.length > 0) && (
        <section className="rv bg-bg py-14 lg:py-20">
          <div className={`mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:gap-14 ${about.length && facts.length ? 'lg:grid-cols-[1.6fr_1fr]' : ''}`}>
            {about.length > 0 && (
              <div>
                <Cap />
                <h2 className="font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]">
                  {U.about} <E p={`services.items.${n}.t`}>{s.t}</E>
                </h2>
                {about.map((p) => (
                  <p key={p.path} className="mt-5 max-w-[62ch] text-[17px] leading-[1.72] text-ink">
                    <E p={p.path}>{p.text}</E>
                  </p>
                ))}
              </div>
            )}
            {facts.length > 0 && (
              <aside className="rounded-[16px] bg-bgSoft p-6 shadow-[inset_0_0_0_1px_var(--rule)] lg:mt-[22px] lg:p-7">
                <h2 className="font-heading text-[21px] font-semibold leading-[1.15] text-ink">{U.facts}</h2>
                <dl className="mt-1">
                  {facts.map((f, k) => (
                    <div key={f.label} className={k ? 'mt-3.5 border-t border-rule pt-3.5' : 'mt-3.5'}>
                      <dt className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-inkSoft">{f.label}</dt>
                      <dd className="mt-1 font-heading text-[18px] font-semibold leading-[1.3] text-ink">
                        {f.values.map((v, j) => (
                          <span key={v.path}>{j > 0 && ', '}<E p={v.path}>{v.text}</E></span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </aside>
            )}
          </div>
        </section>
      )}

      {included.length > 0 && (
        <section className="rv bg-bgSoft py-14 lg:py-20">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <h2 className="font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]">{W.included}</h2>
            <ul className="rv-stagger mt-8 grid gap-3.5 sm:grid-cols-2">
              {included.map((x) => (
                <li key={x.path} className="shadow-brand-1 flex items-start gap-4 rounded-[14px] border border-rule bg-bg p-5">
                  <span className="accent-bar grid !h-9 !w-9 shrink-0 place-items-center !rounded-[10px] text-onInk" aria-hidden="true">
                    <Check size={17} weight="bold" />
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[16px] font-semibold leading-[1.4] text-ink"><E p={x.path}>{x.text}</E></b>
                    {x.note && <span className="mt-1 block text-[14.5px] leading-[1.55] text-inkSoft"><E p={x.notePath}>{x.note}</E></span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* What affects the price: the client's own answer to Q5, hidden when they gave none. */}
      <ServicePriceFactors s={s} look={blockLook('bg-bg')} />

      {signs.length > 0 && (
        <section className="rv bg-inkPanel py-14 text-onInk lg:py-20">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <h2 className="font-heading text-[30px] font-semibold leading-[1.04] text-onInk lg:text-[36px]">{W.signs}</h2>
            <ul className="mt-8 grid gap-3.5 sm:grid-cols-2">
              {signs.map((x) => (
                <li key={x.path} className="flex items-start gap-4 rounded-[14px] border border-ruleInk bg-[color:color-mix(in_srgb,var(--on-ink)_4%,transparent)] p-5">
                  <span className="sign-ring mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full bg-accent text-accent" aria-hidden="true" />
                  <span className="min-w-0">
                    <b className="block text-[16px] font-semibold leading-[1.4] text-onInk"><E p={x.path}>{x.text}</E></b>
                    {x.note && <span className="mt-1 block text-[14.5px] leading-[1.55] text-onInkSoft"><E p={x.notePath}>{x.note}</E></span>}
                  </span>
                </li>
              ))}
            </ul>
            {brand.phoneHref && (
              <a
                href={brand.phoneHref}
                className="mt-7 inline-flex items-center gap-2.5 rounded-[10px] bg-accent px-[22px] py-[13px] font-heading text-[19px] font-semibold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105"
              >
                <Phone size={18} weight="fill" aria-hidden="true" />
                <E p="brand.phone">{brand.phone}</E>
              </a>
            )}
          </div>
        </section>
      )}

      {expect.length > 0 && (
        <section className="rv bg-bgSoft py-16 lg:py-[88px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
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

      {/* {Service} in nearby towns: the town + service pages the site has, hidden until one exists. */}
      <ServiceNearbyTowns content={content} s={s} look={blockLook('bg-bgSoft')} />

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

      {review && (
        <section className="rv bg-bgSoft py-16 lg:py-[88px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <div className="grid items-stretch gap-[22px]">
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
                        <span className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[10px] isolate" aria-hidden="true">
                          <CoverImage url={img} alt="" sizes="96px" />
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
