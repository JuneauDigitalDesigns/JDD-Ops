'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailFooter — near-black footer, premium pass (2026-11-09, approved mockup). Same structure as
// HvacFooter (brand column + client link columns + derived contact column + legal bar) on the
// ink-panel, one step darker than the page's own bg: champagne mark, blurb, gold-bordered trust
// badge chips, muted uppercase column heads, links that brighten on hover, accent contact icons.
// Reads brand.* + footer.* + extensions.trustBadges.
//
// Service pages pass (Xander 2026-11-10, as HvacFooter): "Find us on" lists the client's own
// profiles (Google first, rel="me", hidden when none); a service-area business never shows its
// street (displayAddress); opening hours show from extensions.hours when present.
//
// Every colour is a palette token (ink-panel, on-ink, on-ink-soft, rule-ink, accent); the mark
// is the accent pulled toward black and the badge border is the accent at 30%.
// ─────────────────────────────────────────────────────────────────────────────
import {
  Phone, EnvelopeSimple, MapPin, Clock,
  GoogleLogo, FacebookLogo, InstagramLogo, Star, SealCheck, HouseLine, Storefront, GlobeSimple,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { displayAddress, profileLinks, type ProfileKind } from '@/lib/serviceLinks';

/** D11 heading, approved word for word by Xander on 2026-11-10. */
const FIND_US_ON = 'Find us on';
const PROFILE_ICON: Record<ProfileKind, Icon> = {
  google: GoogleLogo, facebook: FacebookLogo, yelp: Star, bbb: SealCheck, angi: HouseLine,
  nextdoor: Storefront, instagram: InstagramLogo, other: GlobeSimple,
};

export const meta = {
  id: 'detail-footer',
  category: 'footer',
  label: 'Car Detailing / Footer',
  consumes: ['brand.name', 'brand.tagline', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address', 'brand.license', 'footer.blurb', 'footer.cols', 'footer.legal', 'extensions.trustBadges', 'extensions.profiles', 'extensions.serviceAreaBusiness', 'extensions.hours'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

const GOLD_MARK = 'linear-gradient(145deg, var(--accent), color-mix(in srgb, var(--accent) 65%, black))';

export default function DetailFooter({ content = CONTENT }: { content?: SiteContent }) {
  const { footer, brand, extensions } = content;
  const badges = extensions.trustBadges ?? [];
  // "Find us on" (D11): the client's own profiles, Google first; hidden when there are none.
  // rel="me" ties the profile to the site; no nofollow on the business's own profiles.
  const profiles = profileLinks(content);
  // A service-area business never shows its street (Google Business Profile rule).
  const address = displayAddress(content);
  const hours = Object.entries(extensions.hours ?? {}).filter(([d, h]) => d.trim() && h?.trim());
  // The common shape is { all: "Mon to Fri 8am to 5pm" }: "all" is a key, not a label, so it isn't shown.
  const isAllDays = (d: string) => /^all$/i.test(d.trim());
  // The common shape is { all: "Mon to Fri 8am to 5pm" }: "all" is a key, not a label, so it isn't shown.
  const col = 'block py-[5px] text-[14.5px] text-onInkSoft transition-colors hover:text-onInk';
  const head = 'mb-3.5 font-sans text-[12.5px] font-bold uppercase tracking-[0.12em] text-[color:color-mix(in_srgb,var(--on-ink-soft)_80%,transparent)]';

  return (
    <footer className="bg-inkPanel pb-8 pt-16 text-onInkSoft">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.1fr]">
          <div className="md:col-span-2 lg:col-span-1">
            <a href="/" className="flex items-center gap-[11px] text-onInk">
              <span
                className="h-9 w-9 shrink-0 rounded-[8px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                style={{ background: GOLD_MARK }}
                aria-hidden="true"
              />
              <span className="font-heading text-[22px] font-extrabold leading-none tracking-[-0.016em]">
                <E p="brand.name">{brand.name}</E>
                {brand.tagline && <small className="mt-1 block font-sans text-[11px] font-medium tracking-[0.04em] text-onInkSoft"><E p="brand.tagline">{brand.tagline}</E></small>}
              </span>
            </a>
            <p className="mt-4 max-w-[34ch] text-[14.5px] leading-[1.6]"><E p="footer.blurb">{footer.blurb}</E></p>
            {badges.length > 0 && (
              <div className="mt-[18px] flex flex-wrap gap-2">
                {badges.map((b, i) => (
                  <span
                    key={b}
                    className="rounded-[4px] border border-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] px-[11px] py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-accent"
                  >
                    <E p={`extensions.trustBadges.${i}`}>{b}</E>
                  </span>
                ))}
              </div>
            )}
            {profiles.length > 0 && (
              <div className="mt-6">
                <h4 className={head.replace('mb-3.5', 'mb-3')}>{FIND_US_ON}</h4>
                <ul className="flex flex-wrap gap-2">
                  {profiles.map((pr) => {
                    const Ic = PROFILE_ICON[pr.kind];
                    return (
                      <li key={pr.path}>
                        <a
                          href={pr.url}
                          rel="me noopener"
                          target="_blank"
                          className="flex items-center gap-2 rounded-[8px] border border-ruleInk px-3 py-1.5 text-[13px] font-semibold text-onInkSoft transition-colors hover:border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] hover:text-onInk"
                        >
                          <Ic size={15} weight="fill" className="text-accent" aria-hidden="true" />
                          {pr.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {footer.cols.map((c, ci) => (
            <div key={c.h || ci}>
              <h4 className={head}><E p={`footer.cols.${ci}.h`}>{c.h}</E></h4>
              {c.links.map((l, li) => (
                <a key={l.href + li} href={l.href} className={col}><E p={`footer.cols.${ci}.links.${li}.label`}>{l.label}</E></a>
              ))}
            </div>
          ))}

          <div className="min-w-0">
            <h4 className={head}>Contact</h4>
            <a href={brand.phoneHref} className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-onInkSoft transition-colors hover:text-onInk">
              <Phone size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><E p="brand.phone">{brand.phone}</E>
            </a>
            {brand.email && (
              <a href={`mailto:${brand.email}`} className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-onInkSoft transition-colors [overflow-wrap:anywhere] hover:text-onInk">
                <EnvelopeSimple size={16} weight="bold" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><E p="brand.email">{brand.email}</E>
              </a>
            )}
            {address && (
              <span className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-onInkSoft">
                <MapPin size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                {address === brand.address ? <E p="brand.address">{brand.address}</E> : address}
              </span>
            )}
            {hours.length > 0 && (
              <div className="flex items-start gap-[9px] py-[5px] text-[14.5px] text-onInkSoft">
                <Clock size={16} weight="fill" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  {hours.map(([d, h]) => (
                    <div key={d} className="contents">
                      {!isAllDays(d) && <dt className="text-onInk">{d}</dt>}
                      <dd className={isAllDays(d) ? 'col-span-2' : undefined}><E p={`extensions.hours.${d}`}>{h}</E></dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        <div className="mt-11 flex flex-wrap justify-between gap-4 border-t border-ruleInk pt-[22px] text-[13px]">
          <span><E p="footer.legal">{footer.legal}</E></span>
          {brand.license && <span>Licensed &amp; insured · {brand.license}</span>}
        </div>
      </div>
    </footer>
  );
}
