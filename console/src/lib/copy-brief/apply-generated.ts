/**
 * Turns the copywriter's structured output (CopyResult) into a Partial<SiteContent> overlay
 * — extracted verbatim from generate-copy/route.ts's inline merge logic (P6 of the intake
 * rebuild) so the route's rewrite for NDJSON streaming + brief-driven prompts doesn't have to
 * duplicate or risk this already-correct, already-tested merge behavior.
 *
 * `want` gates which top-level SiteContent keys get built — only the requested sections (plus
 * brand, always) so an overlay never touches content the operator didn't ask to regenerate.
 */
import type { SiteContent } from '@/data/site';
import type { CopyResult, Section } from '@/lib/copy-schema';

function mergeArray<B, C>(base: B[], copy: C[] | undefined, apply: (b: B, c: C) => B): B[] {
  if (!Array.isArray(base)) return base;
  return base.map((b, i) => (copy && copy[i] ? apply(b, copy[i]) : b));
}

export function applyGeneratedCopy(
  base: SiteContent,
  copy: Partial<CopyResult>,
  want: Set<Section>,
): Partial<SiteContent> {
  const generated: Partial<SiteContent> = {};

  if (want.has('brand')) {
    const cb = copy.brand;
    const brand = { ...base.brand };
    if (cb) {
      if (cb.tagline) brand.tagline = cb.tagline;
      if (cb.name) { brand.name = cb.name; brand.short = cb.short ?? cb.name; }
      else if (cb.short) brand.short = cb.short;
      if (cb.long) brand.long = cb.long;
      if (cb.established) brand.established = cb.established;
      if (cb.phone) { brand.phone = cb.phone; brand.phoneHref = `tel:${cb.phone.replace(/[^0-9+]/g, '')}`; }
      if (cb.email) brand.email = cb.email;
      if (cb.address) brand.address = cb.address;
      if (cb.license) brand.license = cb.license;
    }
    generated.brand = brand;
  }

  if (want.has('announcement') && copy.announcement?.text) {
    generated.announcement = copy.announcement.text;
  }

  if (want.has('trust') && copy.trust) {
    generated.trust = {
      ...base.trust,
      ...(copy.trust.label ? { label: copy.trust.label } : {}),
      ...(copy.trust.logos?.length ? { logos: copy.trust.logos } : {}),
    };
  }

  if (want.has('hero')) {
    const h: Partial<NonNullable<CopyResult['hero']>> = copy.hero ?? {};
    generated.hero = {
      ...base.hero,
      eyebrow: h.eyebrow ?? base.hero.eyebrow,
      headline: h.headline ?? base.hero.headline,
      headlineEmphasis: h.headlineEmphasis ?? base.hero.headlineEmphasis,
      sub: h.sub ?? base.hero.sub,
      cta: h.cta ?? base.hero.cta,
      secondaryCta: h.secondaryCta ?? base.hero.secondaryCta,
      formLabel: h.formLabel ?? base.hero.formLabel,
      trust: h.trust ?? base.hero.trust,
      badge: h.badge ?? base.hero.badge,
      frictionReducers: h.frictionReducers?.length ? h.frictionReducers : base.hero.frictionReducers,
      heroBullets: h.heroBullets?.length ? h.heroBullets : base.hero.heroBullets,
    };
  }

  if (want.has('about')) {
    const a: Partial<NonNullable<CopyResult['about']>> = copy.about ?? {};
    generated.about = {
      ...base.about,
      eyebrow: a.eyebrow ?? base.about.eyebrow,
      title: a.title ?? base.about.title,
      body: a.body ?? base.about.body,
      pillars: mergeArray(base.about.pillars, a.pillars, (b, c) => ({ ...b, t: c.t ?? b.t, d: c.d ?? b.d })),
      stats: a.stats?.length
        ? mergeArray(base.about.stats, a.stats, (b, c) => ({ ...b, n: c.n ?? b.n, l: c.l ?? b.l }))
        : base.about.stats,
    };
  }

  if (want.has('services')) {
    const s: Partial<NonNullable<CopyResult['services']>> = copy.services ?? {};
    generated.services = {
      ...base.services,
      eyebrow: s.eyebrow ?? base.services.eyebrow,
      title: s.title ?? base.services.title,
      sub: s.sub ?? base.services.sub,
      items: mergeArray(base.services.items, s.items, (b, c) => ({
        ...b, t: c.t ?? b.t, d: c.d ?? b.d, tag: c.tag ?? b.tag,
      })),
    };
  }

  if (want.has('work')) {
    const w: Partial<NonNullable<CopyResult['work']>> = copy.work ?? {};
    generated.work = {
      ...base.work,
      eyebrow: w.eyebrow ?? base.work.eyebrow,
      title: w.title ?? base.work.title,
      sub: w.sub ?? base.work.sub,
      projects: w.projects?.length
        ? mergeArray(base.work.projects, w.projects, (b, c) => ({
            ...b, t: c.t ?? b.t, loc: c.loc ?? b.loc, yr: c.yr ?? b.yr, scope: c.scope ?? b.scope, size: c.size ?? b.size, caption: c.caption ?? b.caption,
          }))
        : base.work.projects,
    };
  }

  if (want.has('testimonials')) {
    const t: Partial<NonNullable<CopyResult['testimonials']>> = copy.testimonials ?? {};
    generated.testimonials = {
      ...base.testimonials,
      eyebrow: t.eyebrow ?? base.testimonials.eyebrow,
      title: t.title ?? base.testimonials.title,
      items: mergeArray(base.testimonials.items, t.items, (b, c) => ({
        ...b, q: c.q ?? b.q, a: c.a ?? b.a, r: c.r ?? b.r, company: c.company ?? b.company, stars: c.stars ?? b.stars,
      })),
    };
  }

  if (want.has('faq')) {
    const f: Partial<NonNullable<CopyResult['faq']>> = copy.faq ?? {};
    generated.faq = {
      ...base.faq,
      eyebrow: f.eyebrow ?? base.faq.eyebrow,
      title: f.title ?? base.faq.title,
      sub: f.sub ?? base.faq.sub,
      items: f.items?.length ? f.items.map((c) => ({ q: c.q, a: c.a })) : base.faq.items,
    };
  }

  if (want.has('finalCta')) {
    const f: Partial<NonNullable<CopyResult['finalCta']>> = copy.finalCta ?? {};
    generated.finalCta = {
      ...base.finalCta,
      eyebrow: f.eyebrow ?? base.finalCta.eyebrow,
      headline: f.headline ?? base.finalCta.headline,
      sub: f.sub ?? base.finalCta.sub,
      cta: f.cta ?? base.finalCta.cta,
      secondary: f.secondary ?? base.finalCta.secondary,
      frictionReducers: f.frictionReducers?.length ? f.frictionReducers : base.finalCta.frictionReducers,
    };
  }

  if (want.has('footer') && copy.footer?.blurb) {
    generated.footer = { ...base.footer, blurb: copy.footer.blurb };
  }

  if (want.has('seo')) {
    const s: Partial<NonNullable<CopyResult['seo']>> = copy.seo ?? {};
    generated.seo = {
      ...base.seo,
      title: s.title ?? base.seo.title,
      description: s.description ?? base.seo.description,
    };
  }

  return generated;
}
