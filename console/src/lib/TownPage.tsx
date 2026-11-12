'use client';
// The town page (/areas/<town>), the town + service page (/areas/<town>/<service>) and the /areas
// index, drawn once here and dressed by each trade in its own look (the trade's TownHeader and
// TownBody pass a TownHeaderLook / TownBodyLook mirroring its service page). Xander approved the
// mockups "HVAC Town Pages" on 2026-11-12: "Build as shown", with T1 to T5 word for word.
//
//   Town page        header: "Home › Areas › {Town}", "{Trade} in {Town}", the intro, the phone
//                    body:   Our services in {Town} · Recent jobs in {Town} ·
//                            What our {Town} customers say · Working in {Town}
//   Town + service   header: "Home › Areas › {Town} › {Service}", "{Service} in {Town}", the intro
//                    body:   the jobs and reviews tagged to both, then "More of our work in {Town}"
//                            and "About our {service} service"
//   /areas index     header: "Home › Areas", "Areas we serve"; body: every town served
//   service page     "What changes the price" and "{Service} in nearby towns" (each trade's
//                    ServiceDetail places them), each hidden until it has data
//
// Every block is hidden when it has no data, and a page the site doesn't have (not in
// content.areaPages) renders nothing. Each body block carries `data-src` (intro, services, job,
// review, note) and no body text sits outside one: the local SEO check over the built HTML proves
// the page says nothing beyond its town's facts, and scorePage.ts's 40% share counts exactly these.
// The header, breadcrumb and call to action are not body.
//
// BYTE-IDENTICAL in console/src/lib and template/src/lib (console/test/town-pages.test.mjs).
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, MapPin, Phone } from '@phosphor-icons/react';
import { E } from '@/lib/editable';
import { CoverImage } from '@/lib/CoverImage';
import type { ServiceRef } from '@/lib/serviceLinks';
import {
  AREA_WORDS, aboutOurService, areaHref, areasIndex, nearbyTownLinks, priceFactors, townHeaderPhoto, townIntro,
  townJobs, townNotes, townPageFor, townReviews, townServices,
} from '@/lib/townLinks';

/** Any SiteContent shape: read structurally, like the rest of the shared town page code. */
type Content = unknown;

/** A trade's header look: the classes of its service page header. */
export type TownHeaderLook = {
  /** What the business does, for "{Trade} in {Town}" (the console's TRADE_LABELS). */
  trade: string;
  section: string;
  /** The wash and scrim drawn over the photo (or the bare panel when there is none). */
  overlays: ReactNode;
  photoStyle?: CSSProperties;
  inner: string;
  crumbs: string;
  h1: string;
  intro: string;
  phone: string;
  phoneStyle?: CSSProperties;
};

/** A trade's body look: the classes of its service page body. */
export type TownBodyLook = {
  /** What the business does: the /areas index labels each town page link "{Trade} in {Town}". */
  trade: string;
  /** The accent mark above a heading. */
  cap: ReactNode;
  h2: string;
  /** Section backgrounds, alternated down the page. */
  bands: [string, string];
  card: string;
  photo: string;
  muted: string;
  link: string;
  chip: string;
  chipLink: string;
};

const WRAP = 'mx-auto max-w-[1120px] px-5 sm:px-6';

export function TownHeader({
  content, townSlug, serviceSlug, look,
}: { content: Content; townSlug?: string; serviceSlug?: string; look: TownHeaderLook }) {
  const W = AREA_WORDS;
  const page = townSlug ? townPageFor(content, townSlug, serviceSlug) : null;
  if (townSlug && !page) return null;
  const brand = ((content as { brand?: { phone?: string; phoneHref?: string } } | null)?.brand) ?? {};
  const photo = page ? townHeaderPhoto(content, page.area, page.service) : null;
  const intro = page ? townIntro(content, page.area.slug, page.service?.slug) : null;
  const sep = <li className="opacity-55" aria-hidden="true">›</li>;
  const town = page?.area.town ?? '';

  return (
    <section id="top" className={look.section}>
      {photo && (
        <div className="absolute inset-0 isolate overflow-hidden" style={look.photoStyle}>
          <CoverImage url={photo.url} alt={photo.alt} sizes="100vw" priority />
        </div>
      )}
      {look.overlays}
      <div className={look.inner}>
        <nav aria-label="Breadcrumb" className="mb-5 lg:mb-[26px]">
          <ol className={look.crumbs}>
            <li><a href="/" className="transition-colors hover:text-onInk">{W.home}</a></li>
            {sep}
            {page ? (
              <li><a href="/areas" className="transition-colors hover:text-onInk">{W.areas}</a></li>
            ) : (
              <li aria-current="page" className="text-onInk">{W.areas}</li>
            )}
            {page && sep}
            {page && !page.service && <li aria-current="page" className="text-onInk">{town}</li>}
            {page?.service && (
              <>
                <li><a href={areaHref(page.area.slug)} className="transition-colors hover:text-onInk">{town}</a></li>
                {sep}
                <li aria-current="page" className="text-onInk"><E p={`services.items.${page.service.index}.t`}>{page.service.t}</E></li>
              </>
            )}
          </ol>
        </nav>

        <h1 className={look.h1}>
          {!page && W.areasWeServe}
          {page && (
            <>
              {page.service ? <E p={`services.items.${page.service.index}.t`}>{page.service.t}</E> : look.trade}
              {' '}{W.in} <span className="text-accent">{town}</span>
            </>
          )}
        </h1>

        {intro && (
          <p data-src="intro" className={look.intro}>
            <E p={intro.path}>{intro.text}</E>
          </p>
        )}

        {page && brand.phoneHref && (
          <div className="mt-7">
            <a href={brand.phoneHref} className={look.phone} style={look.phoneStyle}>
              <Phone size={20} weight="fill" aria-hidden="true" />
              <E p="brand.phone">{brand.phone ?? ''}</E>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

export function TownBody({
  content, townSlug, serviceSlug, look,
}: { content: Content; townSlug?: string; serviceSlug?: string; look: TownBodyLook }) {
  if (!townSlug) return <AreasList content={content} look={look} />;
  const page = townPageFor(content, townSlug, serviceSlug);
  if (!page) return null;
  const W = AREA_WORDS;
  const { area, service } = page;
  const town = area.town;
  const services = service ? [] : townServices(content, area);
  const jobs = townJobs(content, town, service?.slug);
  const reviews = townReviews(content, town, service?.slug);
  const notes = service ? [] : townNotes(content, town);

  // Bands alternate over the blocks actually shown, so two hidden blocks never leave two alike.
  const blocks: { key: string; node: (band: string) => ReactNode }[] = [];
  if (services.length) blocks.push({ key: 'services', node: (band) => (
    <section key="services" data-src="services" className={`rv ${band} py-14 lg:py-20`}>
      <div className={WRAP}>
        {look.cap}
        <h2 className={look.h2}>{W.ourServicesIn(town)}</h2>
        <ul className="rv-stagger mt-8 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(({ s, href, image }) => (
            <li key={s.slug}>
              <a href={href} className={`group flex items-center gap-4 p-4 transition-[transform,border-color] duration-300 hover:-translate-y-[3px] ${look.card}`}>
                {image && (
                  <span className="relative isolate h-[60px] w-[60px] shrink-0 overflow-hidden rounded-[10px]" aria-hidden="true">
                    <CoverImage url={image} alt="" sizes="72px" />
                  </span>
                )}
                <b className="min-w-0 font-heading text-[18px] font-semibold leading-[1.15] text-ink"><E p={`services.items.${s.index}.t`}>{s.t}</E></b>
                <ArrowRight size={20} weight="bold" className={`ml-auto shrink-0 transition-transform duration-300 group-hover:translate-x-[3px] ${look.link}`} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  ) });
  if (jobs.length) blocks.push({ key: 'jobs', node: (band) => (
    <section key="jobs" data-src="job" className={`rv ${band} py-14 lg:py-20`}>
      <div className={WRAP}>
        {look.cap}
        <h2 className={look.h2}>{W.recentJobsIn(town)}</h2>
        <ul className="rv-stagger mt-8 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((j) => (
            <li key={j.captionPath}>
              <figure className={`m-0 overflow-hidden ${look.photo}`}>
                <div className="relative isolate aspect-[3/2] overflow-hidden">
                  <CoverImage url={j.url} alt={j.alt} sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" />
                </div>
                <figcaption className="px-4 py-3.5">
                  {j.caption && <b className="block text-[16px] font-semibold leading-[1.35] text-ink"><E p={j.captionPath}>{j.caption}</E></b>}
                  <span className={`mt-1 flex items-center gap-1.5 text-[13.5px] ${look.muted}`}>
                    <MapPin size={14} weight="fill" className="text-accent" aria-hidden="true" />
                    {j.town}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  ) });
  if (reviews.length) blocks.push({ key: 'reviews', node: (band) => (
    <section key="reviews" data-src="review" className={`rv ${band} py-14 lg:py-20`}>
      <div className={WRAP}>
        {look.cap}
        <h2 className={look.h2}>{W.customersSay(town)}</h2>
        <ul className="mt-8 grid gap-[18px] lg:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.path}>
              <figure className={`m-0 h-full p-6 lg:p-8 ${look.card}`}>
                <div className="tracking-[2px] text-[color:var(--star)]" aria-hidden="true">★★★★★</div>
                <blockquote className="mt-4 text-[18px] font-medium leading-[1.5] text-ink">
                  <E p={`${r.path}.q`}>{r.q}</E>
                </blockquote>
                {r.a && (
                  <figcaption data-attribution className={`mt-5 text-[14px] font-semibold ${look.muted}`}>
                    <E p={`${r.path}.a`}>{r.a}</E>
                  </figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  ) });
  if (notes.length) blocks.push({ key: 'notes', node: (band) => (
    <section key="notes" data-src="note" className={`rv ${band} py-14 lg:py-20`}>
      <div className={WRAP}>
        {look.cap}
        <h2 className={look.h2}>{W.workingIn(town)}</h2>
        <ul className="mt-6 max-w-[760px] border-t border-rule">
          {notes.map((n) => (
            <li key={n.path} className="flex items-start gap-3.5 border-b border-rule py-4 text-[16.5px] leading-[1.6] text-ink">
              <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent-2)]" aria-hidden="true" />
              <span>
                <E p={n.path}>{n.text}</E>{' '}
                <a href={n.url} rel="nofollow noopener" target="_blank" className={`whitespace-nowrap text-[14px] font-semibold underline underline-offset-2 ${look.link}`}>{W.source}</a>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  ) });
  if (service) blocks.push({ key: 'links', node: (band) => (
    <section key="links" data-src="services" className={`rv ${band} py-12 lg:py-16`}>
      <div className={`${WRAP} grid gap-3.5 sm:grid-cols-2`}>
        <a href={areaHref(area.slug)} className={`group flex items-center justify-between gap-4 px-5 py-4 ${look.card}`}>
          <b className="font-heading text-[18px] font-semibold leading-[1.2] text-ink">{W.moreWorkIn(town)}</b>
          <ArrowUpRight size={20} weight="bold" className={`shrink-0 ${look.link}`} aria-hidden="true" />
        </a>
        <a href={service.href ?? `/services/${service.slug}`} className={`group flex items-center justify-between gap-4 px-5 py-4 ${look.card}`}>
          <b className="font-heading text-[18px] font-semibold leading-[1.2] text-ink">{aboutOurService(service.t)}</b>
          <ArrowRight size={20} weight="bold" className={`shrink-0 transition-transform duration-300 group-hover:translate-x-[3px] ${look.link}`} aria-hidden="true" />
        </a>
      </div>
    </section>
  ) });

  return <>{blocks.map((b, i) => b.node(look.bands[i % 2]))}</>;
}

/** How a trade draws a block on its service page (its own accent mark, heading, band and card). */
export type ServiceBlockLook = { cap: ReactNode; h2: string; band: string; card: string; link: string };

/**
 * "What changes the price" on a service page (approved 2026-11-12): the client's own answer to
 * "What makes this job cost more or less?" (Q5), word for word. Hidden when they gave none; never
 * generated, and never a price.
 */
export function ServicePriceFactors({ s, look }: { s: ServiceRef; look: ServiceBlockLook }) {
  const items = priceFactors(s);
  if (!items.length) return null;
  return (
    <section className={`rv ${look.band} py-14 lg:py-20`}>
      <div className={WRAP}>
        {look.cap}
        <h2 className={look.h2}>{AREA_WORDS.priceFactors}</h2>
        <ul className="mt-7 grid max-w-[860px] gap-3 sm:grid-cols-2">
          {items.map((x) => (
            <li key={x.path} className={`flex items-start gap-3.5 p-4 text-[16px] font-semibold leading-[1.45] text-ink ${look.card}`}>
              <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <E p={x.path}>{x.text}</E>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * "{Service} in nearby towns" on a service page (approved 2026-11-12): a link to each town + service
 * page the site has for this service, "{Service} in {Town}". Hidden until one exists.
 */
export function ServiceNearbyTowns({ content, s, look }: { content: Content; s: ServiceRef; look: ServiceBlockLook }) {
  const towns = nearbyTownLinks(content, s.slug);
  if (!towns.length) return null;
  return (
    <section className={`rv ${look.band} py-14 lg:py-20`}>
      <div className={WRAP}>
        {look.cap}
        <h2 className={look.h2}>{AREA_WORDS.nearbyTowns(s.t)}</h2>
        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {towns.map((t) => (
            <li key={t.href}>
              <a href={t.href} className={`group flex items-center justify-between gap-3 px-5 py-4 font-heading text-[17px] font-semibold leading-[1.25] text-ink ${look.card}`}>
                {AREA_WORDS.inTown(s.t, t.town)}
                <ArrowRight size={18} weight="bold" className={`shrink-0 transition-transform duration-300 group-hover:translate-x-[3px] ${look.link}`} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The /areas index: every town served. The main city links home, labelled "Home"; a town page's
 *  link carries its own heading, "{Trade} in {Town}"; every other town is plain text. */
function AreasList({ content, look }: { content: Content; look: TownBodyLook }) {
  const towns = areasIndex(content);
  if (!towns.length) return null;
  return (
    <section className={`rv ${look.bands[0]} py-14 lg:py-20`}>
      <ul className={`${WRAP} flex flex-wrap gap-2.5`}>
        {towns.map((t) =>
          t.href ? (
            <li key={t.town}>
              <a href={t.href} className={`flex items-center gap-2 px-[15px] py-[10px] text-[15px] font-bold ${look.chipLink}`}>
                <MapPin size={14} weight="fill" className="text-accent" aria-hidden="true" />
                {t.town}
                <span className={`text-[12.5px] font-semibold ${look.muted}`}>{t.home ? AREA_WORDS.home : AREA_WORDS.inTown(look.trade, t.town)}</span>
              </a>
            </li>
          ) : (
            <li key={t.town} className={`px-[15px] py-[10px] text-[15px] font-bold text-ink ${look.chip}`}>{t.town}</li>
          ),
        )}
      </ul>
    </section>
  );
}
