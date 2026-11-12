'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnServiceDetail — the body of one per-service page (/services/<slug>), blocks 4–12 of
// service-page-spec.md §3, in the approved Lawn language (service-pages mockup, `.v-lawn`, Xander
// 2026-11-10): soft and airy, rounded everywhere. Every block renders ONE service's own content and
// is omitted when its data is absent (D5); no block is a site-wide section, so no two service pages
// share a body.
// Upgraded 2026-11-11 (Xander approved the mockup "HVAC Service Page Upgrade", drawn here in Lawn's
// own language): the price moved into the header, the job photos lead, and the page carries
// generated explanation for search.
//   Our work                  job photos tagged to this service (client photos only, never stock)
//   About {service}           services.items[i].page.body       (generated: facts + general trade knowledge)
//   Know before you book      duration, areas, brands (service's own, else site-wide); only rows given
//   What's included           included[] + page.includedNotes   (round soft ticks, staggered reveal: motion 1)
//   Signs it's time to call   typicalJobs[] + page.signNotes    (forest band, ring per sign: motion 2)
//   What to expect            services.items[i].page.expect     soft round step circles
//   Areas we serve            services.items[i].areas           the mow-stripe coverage band (LawnTrust's)
//   Common questions          tagged customer questions, then page.faq (3–5), rounded cards (LawnFaq's)
//   Proof                     a review tagged to this service
//   Related services          2–3 sibling services that have pages: LawnServices' photo cards, as links
// "Starting at", "/ visit" and "Ask for a quote" are in LawnServiceHeader now.
// Block 13 is LawnFinalCta, which wirePages gives the same serviceSlug.
//
// Each block carries its own `rv` scroll reveal, so this component belongs in SELF_ANIMATED
// (revealPolicy.ts): a reveal on the whole body would fade a page-tall block. Edit paths use the
// ORIGINAL services.items index. Headings were approved word for word on 2026-11-10; "Coverage"
// and "/ visit" are the Lawn template's existing words. Every colour is a palette token: forest =
// ink-panel-2, sun gold = the editable accent2 slot, green tints = accent mixed into bg.
// ─────────────────────────────────────────────────────────────────────────────
import { Check, MapPin, Plus, ArrowRight, Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E, Ico } from '@/lib/editable';
import { serviceIcon } from '@/lib/icons';
import { CoverImage } from '@/lib/CoverImage';
import {
  primaryCity, relatedServices, serviceBySlug, serviceList, serviceProof, serviceQuestions,
} from '@/lib/serviceLinks';
import {
  SERVICE_UPGRADE_WORDS, aboutParagraphs, listWithNotes, ourWorkPhotos, serviceFacts,
} from '@/lib/servicePage';

export const meta = {
  id: 'lawn-service-detail',
  category: 'services',
  label: 'Lawn / Service page body',
  consumes: ['services.items', 'servicePages', 'testimonials.items', 'work.projects', 'extensions.customerQuestions', 'extensions.brandsCarried', 'brand.address', 'extensions.serviceArea', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable', '@/lib/icons', '@/lib/serviceLinks', '@/lib/servicePage'],
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
        <section className="rv bg-bg pb-4 pt-14 lg:pt-[92px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <h2 className={H2}>{U.ourWork}</h2>
            <div className={`mt-7 grid gap-4 lg:gap-[22px] ${work.length > 1 ? 'sm:grid-cols-[1.3fr_1fr]' : ''}`}>
              {work.map((ph, k) => (
                <figure
                  key={ph.path}
                  className={`shadow-brand-1 relative isolate aspect-[3/2] overflow-hidden rounded-[22px] border border-rule bg-bgSoft ${work.length === 3 && k === 0 ? 'sm:row-span-2 sm:aspect-auto' : ''}`}
                >
                  <CoverImage url={ph.url} alt={headline} sizes={work.length > 1 ? '(min-width: 640px) 50vw, 100vw' : '100vw'} />
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {(about.length > 0 || facts.length > 0) && (
        <section className="rv bg-bg py-14 lg:py-[92px]">
          <div className={`mx-auto grid max-w-[1120px] items-start gap-10 px-5 sm:px-6 lg:gap-14 ${about.length && facts.length ? 'lg:grid-cols-[1.6fr_1fr]' : ''}`}>
            {about.length > 0 && (
              <div>
                <Cap />
                <h2 className={H2}>
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
              <aside className="relative rounded-[22px] bg-bgSoft px-[22px] pb-[22px] pt-[26px] shadow-[inset_0_0_0_1px_var(--rule)] lg:mt-[22px] lg:px-8 lg:pb-7 lg:pt-8">
                <span className="absolute bottom-8 left-0 top-8 w-1 rounded-r-[4px] bg-[color:var(--accent-2)]" aria-hidden="true" />
                <h2 className="font-heading text-[21px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">{U.facts}</h2>
                <dl className="mt-1">
                  {facts.map((f, k) => (
                    <div key={f.label} className={k ? 'mt-3.5 border-t border-rule pt-3.5' : 'mt-3.5'}>
                      <dt className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent">{f.label}</dt>
                      <dd className="mt-1 font-heading text-[18px] font-extrabold leading-[1.3] tracking-[-0.01em] text-ink">
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
        <section className="rv bg-bgSoft py-14 lg:py-[92px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <h2 className={H2}>{W.included}</h2>
            <ul className="rv-stagger mt-8 grid gap-3.5 sm:grid-cols-2 lg:gap-4">
              {included.map((x) => (
                <li key={x.path} className="shadow-brand-1 flex items-start gap-4 rounded-[22px] border border-rule bg-bg p-5 lg:p-[22px]">
                  <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[color:var(--accent-2-soft)] text-accent" aria-hidden="true">
                    <Check size={16} weight="bold" />
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[16px] font-semibold leading-[1.45] text-ink"><E p={x.path}>{x.text}</E></b>
                    {x.note && <span className="mt-1 block text-[15px] leading-[1.6] text-inkSoft"><E p={x.notePath}>{x.note}</E></span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {signs.length > 0 && (
        <section className="rv bg-inkPanel2 py-14 text-onInk lg:py-[92px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
            <Cap />
            <h2 className={`${H2} !text-onInk`}>{W.signs}</h2>
            <ul className="mt-8 grid gap-3.5 sm:grid-cols-2 lg:gap-4">
              {signs.map((x) => (
                <li
                  key={x.path}
                  className="flex items-start gap-4 rounded-[22px] border border-[color:color-mix(in_srgb,var(--on-ink)_16%,transparent)] bg-[color:color-mix(in_srgb,var(--on-ink)_5%,transparent)] p-5 lg:p-[22px]"
                >
                  <span className="sign-ring mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full bg-accent text-accent" aria-hidden="true" />
                  <span className="min-w-0">
                    <b className="block text-[16px] font-semibold leading-[1.45] text-onInk"><E p={x.path}>{x.text}</E></b>
                    {x.note && <span className="mt-1 block text-[15px] leading-[1.6] text-onInkSoft"><E p={x.notePath}>{x.note}</E></span>}
                  </span>
                </li>
              ))}
            </ul>
            {brand.phoneHref && (
              <a
                href={brand.phoneHref}
                className="mt-8 inline-flex items-center gap-2.5 rounded-[14px] bg-accent px-[22px] py-[14px] font-heading text-[19px] font-bold tracking-[-0.01em] text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
                style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
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

      {review && (
        <section className="rv bg-bgSoft py-16 lg:py-[88px]">
          <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
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
                          className="relative block aspect-[16/9] isolate overflow-hidden"
                        >
                          <CoverImage url={photo} alt={item?.image?.alt ?? r.t} sizes="(min-width: 1024px) 50vw, 100vw" />
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
