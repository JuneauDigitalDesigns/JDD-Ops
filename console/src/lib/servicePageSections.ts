// Every catalog section that takes `serviceSlug` on a per-service page (/services/<slug>,
// service-page-spec.md §3): each vertical's service header, service body and final CTA. wirePages
// emits `serviceSlug="<slug>"` only for these, and the Studio passes it only to these, so a
// component that doesn't declare the prop never receives it. No imports: tests load it directly.
export const SERVICE_PAGE_SECTIONS: ReadonlySet<string> = new Set([
  'HvacServiceHeader', 'HvacServiceDetail', 'HvacFinalCta',
  'DetailServiceHeader', 'DetailServiceDetail', 'DetailFinalCta',
  'LawnServiceHeader', 'LawnServiceDetail', 'LawnFinalCta',
  'PlumbingServiceHeader', 'PlumbingServiceDetail', 'PlumbingFinalCta',
  'RoofingServiceHeader', 'RoofingServiceDetail', 'RoofingFinalCta',
]);
