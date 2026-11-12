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
import { serviceSlugs } from '@/lib/servicePages';
import { servicePageIndices } from '@/lib/copy-brief/compile';
import { clientFaq, pinFixed, withoutRepeats } from '@/lib/copy-brief/client-faq';
import { normalizeRoute } from '@/lib/copy-brief/run-sections';

function mergeArray<B, C>(base: B[], copy: C[] | undefined, apply: (b: B, c: C) => B): B[] {
  if (!Array.isArray(base)) return base;
  return base.map((b, i) => (copy && copy[i] ? apply(b, copy[i]) : b));
}

export function applyGeneratedCopy(
  base: SiteContent,
  copy: Partial<CopyResult>,
  want: Set<Section>,
  /** `subpageRoutes`: the pages this run asked headers for. Given, a reply item for any other
   *  route is dropped, and "/about" lands on "about": an item stored under a key no page reads
   *  looks generated and is never shown. */
  opts: { subpageRoutes?: string[] } = {},
): Partial<SiteContent> {
  const generated: Partial<SiteContent> = {};

  if (want.has('brand')) {
    const cb = copy.brand;
    const brand = { ...base.brand };
    if (cb) {
      if (cb.tagline) brand.tagline = cb.tagline;
      if (cb.name) { brand.name = cb.name; brand.short = cb.short ?? cb.name; }
      else if (cb.short) brand.short = cb.short;
      // brand.long is never read from model output: it is the client's legal name exactly as
      // signed on the agreement (agency PR #106), and it feeds the copyright line and the SEO
      // local-business data. It passes through from base, so the intake or an operator edit holds.
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
      story: a.story?.length ? a.story : base.about.story,
      pillars: mergeArray(base.about.pillars, a.pillars, (b, c) => ({ ...b, t: c.t ?? b.t, d: c.d ?? b.d })),
      // ALWAYS base.about.stats, never model output (PLAN D4) — stats is not even in
      // CopyResult.about any more, so there is no `a.stats` to read. Pure passthrough, same
      // guarantee `about.seasons` needs once a vertical generates copy near it.
      stats: base.about.stats,
      seasons: base.about.seasons,
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
        ...b, t: c.t ?? b.t, d: c.d ?? b.d, tag: c.tag ?? b.tag, detail: c.detail ?? b.detail,
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
      // ALWAYS base.testimonials.items, never model output (operator decision, 2026-11-10): the
      // client's real reviews, or the scaffold's blank slots, which the review sections skip.
      // Never [] in place of blanks: deepMerge reads [] as missing and the preset's sample
      // quotes would fill it.
      items: base.testimonials.items,
    };
  }

  if (want.has('faq')) {
    const f: Partial<NonNullable<CopyResult['faq']>> = copy.faq ?? {};
    // The client's own untagged Q&As (and any tagged to a service with no page) go first, word
    // for word; the model's pairs follow, minus any that ask one of them again (client-faq.ts).
    const fixed = clientFaq(base).home;
    const model = f.items?.length ? f.items.map((c) => ({ q: c.q, a: c.a })) : [];
    generated.faq = {
      ...base.faq,
      eyebrow: f.eyebrow ?? base.faq.eyebrow,
      title: f.title ?? base.faq.title,
      sub: f.sub ?? base.faq.sub,
      items: fixed.length || model.length ? pinFixed(fixed, model, model.length) : base.faq.items,
    };
  }

  if (want.has('finalCta')) {
    const f: Partial<NonNullable<CopyResult['finalCta']>> = copy.finalCta ?? {};
    generated.finalCta = {
      ...base.finalCta,
      eyebrow: f.eyebrow ?? base.finalCta.eyebrow,
      headline: f.headline ?? base.finalCta.headline,
      headlineEmphasis: f.headlineEmphasis ?? base.finalCta.headlineEmphasis,
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

  if (want.has('subpages') && copy.subpages?.items?.length) {
    // Route-keyed merge onto whatever subpages the base already carries, so regenerating one
    // page's copy never drops the others. Each item folds header + per-page SEO into the
    // SiteContent.subpages[route] shape; a cta only survives when BOTH label and href are given.
    const map = { ...(base.subpages ?? {}) };
    const allowed = opts.subpageRoutes ? new Set(opts.subpageRoutes.map(normalizeRoute)) : null;
    for (const it of copy.subpages.items) {
      const route = it.route ? normalizeRoute(it.route) : '';
      if (!route || (allowed && !allowed.has(route))) continue;
      map[route] = {
        header: {
          eyebrow: it.eyebrow,
          title: it.title,
          sub: it.sub,
          cta: it.ctaLabel && it.ctaHref ? { label: it.ctaLabel, href: it.ctaHref } : null,
        },
        seo: { title: it.seoTitle, description: it.seoDescription },
      };
    }
    generated.subpages = map;
  }

  if (want.has('servicePages') && copy.servicePages?.items?.length) {
    // Slug-keyed onto services.items[i].page (service-page-spec.md §4), and ONLY for services the
    // gate gives a page: copy the model returns for a thin or unknown service is dropped, never
    // stored for a page that will not exist. Applied on top of this run's services overlay when
    // there is one, so card copy and page copy generated together both land.
    const slugs = serviceSlugs(base);
    const allowed = new Set(servicePageIndices(base).map((i) => slugs[i]));
    const bySlug = new Map(copy.servicePages.items.filter((it) => it.slug && allowed.has(it.slug)).map((it) => [it.slug, it]));
    // The page lists the client's own tagged Q&As first, straight from customerQuestions
    // (serviceLinks.ts serviceQuestions), so page.faq only loses the model's repeats of them: on
    // 2026-11-11 "Can you come Saturdays?" came back without the client's "TW:" and with an
    // invented 24/7 answer, shown under the client's own.
    const fixedBySlug = clientFaq(base).bySlug;
    if (bySlug.size) {
      const services = generated.services ?? base.services;
      generated.services = {
        ...services,
        items: services.items.map((item, i) => {
          const it = bySlug.get(slugs[i]);
          if (!it) return item;
          // `page` arrives with @jdd/schema v1.32.0; typed structurally until the console pins it.
          const faq = withoutRepeats((it.faq ?? []).map((f) => ({ q: f.q, a: f.a })), fixedBySlug.get(slugs[i]) ?? []);
          return { ...item, page: { intro: it.intro, expect: it.expect ?? [], faq } } as typeof item;
        }),
      };
    }
  }

  return generated;
}
