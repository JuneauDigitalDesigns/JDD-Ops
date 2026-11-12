/**
 * Turns the copywriter's structured output (CopyResult) into a Partial<SiteContent> overlay
 * — extracted verbatim from generate-copy/route.ts's inline merge logic (P6 of the intake
 * rebuild) so the route's rewrite for NDJSON streaming + brief-driven prompts doesn't have to
 * duplicate or risk this already-correct, already-tested merge behavior.
 *
 * `want` gates which top-level SiteContent keys get built — only the requested sections (plus
 * brand, always) so an overlay never touches content the operator didn't ask to regenerate. A
 * section the model returned nothing for is left out entirely.
 */
import type { SiteContent } from '@/data/site';
import type { CopyResult, Section } from '@/lib/copy-schema';
import { serviceSlugs } from '@/lib/servicePages';
import { servicePageIndices } from '@/lib/copy-brief/compile';
import { clientFaq, pinFixed, withoutRepeats } from '@/lib/copy-brief/client-faq';
import { normalizeRoute } from '@/lib/copy-brief/run-sections';
import { isPresent } from '@/lib/merge';

/** The fields of `fields` that carry a value, or null when none does. "Carry a value" is the merge's
 *  own test (isPresent: not null, undefined, blank or an empty list), so leaving a field out here is
 *  exactly what the merge would have done with it, minus the frozen copy of the base. */
function written<T extends Record<string, unknown>>(fields: T): Partial<T> | null {
  const out = Object.fromEntries(Object.entries(fields).filter(([, v]) => isPresent(v))) as Partial<T>;
  return Object.keys(out).length ? out : null;
}

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

  // brand, trust, hero, finalCta, footer and seo hold ONLY the fields the model wrote (F-E6,
  // 2026-11-11). They used to spread `base.<section>`, the Studio's whole effective section, and
  // the generated layer outranks the intake in the Studio's merge (effectiveContent.ts), so every
  // field the model never touched was frozen at its generation-time value: a later correction to
  // clients/{slug}/site.ts stayed hidden unless an operator edit sat on top. A field left out here
  // falls through to the intake (or the preset) at merge time instead.
  if (want.has('brand') && copy.brand) {
    // The tagline only. The business identity (name, short, long, established, phone and
    // phoneHref, email, address, license) is never read from model output and is not in its
    // output schema (copy-schema.ts): it is the client's, and the phone must stay the JDD Twilio
    // number the site advertises. The model sees it as read-only facts.
    const brand = written({ tagline: copy.brand.tagline });
    if (brand) generated.brand = brand as SiteContent['brand'];
  }

  if (want.has('announcement') && copy.announcement?.text) {
    generated.announcement = copy.announcement.text;
  }

  if (want.has('trust') && copy.trust) {
    const trust = written({ label: copy.trust.label, logos: copy.trust.logos });
    if (trust) generated.trust = trust as SiteContent['trust'];
  }

  if (want.has('hero') && copy.hero) {
    const h = copy.hero;
    const hero = written({
      eyebrow: h.eyebrow, headline: h.headline, headlineEmphasis: h.headlineEmphasis, sub: h.sub,
      cta: h.cta, secondaryCta: h.secondaryCta, formLabel: h.formLabel, trust: h.trust, badge: h.badge,
      frictionReducers: h.frictionReducers, heroBullets: h.heroBullets,
    });
    if (hero) generated.hero = hero as SiteContent['hero'];
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

  if (want.has('finalCta') && copy.finalCta) {
    const f = copy.finalCta;
    const finalCta = written({
      eyebrow: f.eyebrow, headline: f.headline, headlineEmphasis: f.headlineEmphasis, sub: f.sub,
      cta: f.cta, secondary: f.secondary, frictionReducers: f.frictionReducers,
    });
    if (finalCta) generated.finalCta = finalCta as SiteContent['finalCta'];
  }

  if (want.has('footer') && copy.footer?.blurb) {
    generated.footer = { blurb: copy.footer.blurb } as SiteContent['footer'];
  }

  if (want.has('seo') && copy.seo) {
    // No canonical, analytics or pixel id: never the copywriter's, and no longer copied up from
    // base (withoutCarriedCanonical in the route still guards the canonical).
    const seo = written({ title: copy.seo.title, description: copy.seo.description });
    if (seo) generated.seo = seo as SiteContent['seo'];
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
