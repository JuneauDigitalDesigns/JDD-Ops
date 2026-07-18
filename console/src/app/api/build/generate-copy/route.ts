import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SiteContent } from '@/data/site';
import { getAnthropicKey } from '@/lib/anthropic';
import { brandCopywriterSystem, buildCopyUserMessage } from '@/lib/brand-copywriter-prompt';
import { buildCopySchema, ALL_SECTIONS, type Section, type CopyResult } from '@/lib/copy-schema';
import { VERTICALS, type VerticalId } from '@/lib/verticals';
import { scanWebsiteNotes, normalizeUrl } from '@/lib/website-scan';

export const runtime = 'nodejs';

function mergeArray<B, C>(base: B[], copy: C[] | undefined, apply: (b: B, c: C) => B): B[] {
  if (!Array.isArray(base)) return base;
  return base.map((b, i) => (copy && copy[i] ? apply(b, copy[i]) : b));
}

export async function POST(req: Request) {
  let body: { vertical?: VerticalId; base?: SiteContent; details?: string; sections?: Section[]; url?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { base, vertical, details } = body;
  if (!base || !base.brand) {
    return NextResponse.json({ error: 'Missing base content.' }, { status: 400 });
  }
  if (!vertical || !VERTICALS.some((v) => v.id === vertical)) {
    return NextResponse.json({ error: 'Unknown vertical.' }, { status: 400 });
  }

  // Only request sections we support; brand is always included.
  const requested = Array.isArray(body.sections)
    ? body.sections.filter((s): s is Section => ALL_SECTIONS.includes(s))
    : ALL_SECTIONS;
  const want = new Set<Section>(['brand', ...requested]);
  const sections = ALL_SECTIONS.filter((s) => want.has(s));

  // Optional website URL to scan and normalize up-front.
  let scanUrl: string | undefined;
  if (typeof body.url === 'string' && body.url.trim()) {
    try {
      scanUrl = normalizeUrl(body.url);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid URL.' }, { status: 400 });
    }
  }

  let key: string;
  try {
    key = getAnthropicKey();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No API key.' }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: key });
  const model = process.env.CONSOLE_COPY_MODEL || 'claude-opus-4-8';

  // Phase 1 — scan the website with web_fetch when a URL was supplied.
  let websiteNotes: string | undefined;
  if (scanUrl) {
    try {
      websiteNotes = await scanWebsiteNotes(client, scanUrl);
    } catch (e) {
      return NextResponse.json(
        { error: `Website scan failed: ${e instanceof Error ? e.message : 'unknown error'}` },
        { status: 502 },
      );
    }
  }

  // Phase 2 — structured copy generation, CHUNKED. Requesting all sections in one
  // json_schema compiles a grammar Claude rejects as too large, so we split the sections
  // into small chunks, generate them in parallel (each with its own small schema), and
  // merge the results. Section keys are disjoint, so the merge is a plain Object.assign;
  // brand is just another chunk member (buildCopySchema(chunk, false)).
  const REFUSAL = '__refusal__';
  const CHUNK_SIZE = 2;
  const chunks: Section[][] = [];
  for (let i = 0; i < sections.length; i += CHUNK_SIZE) chunks.push(sections.slice(i, i + CHUNK_SIZE));

  // Re-capture the guard-narrowed values as locals so the closure keeps their narrowed types.
  const vId: VerticalId = vertical;
  const baseContent: SiteContent = base;

  async function generateChunk(chunk: Section[]): Promise<Partial<CopyResult>> {
    const res = await client.messages.create({
      model,
      max_tokens: 4000,
      system: brandCopywriterSystem(vId),
      output_config: { format: { type: 'json_schema', schema: buildCopySchema(chunk, false) } },
      messages: [{ role: 'user', content: buildCopyUserMessage(vId, baseContent, details, chunk, websiteNotes) }],
    });
    if (res.stop_reason === 'refusal') throw new Error(REFUSAL);
    const tb = res.content.find((b) => b.type === 'text');
    if (!tb || tb.type !== 'text') throw new Error('No copy returned.');
    return JSON.parse(tb.text) as Partial<CopyResult>;
  }

  const settled = await Promise.allSettled(chunks.map(generateChunk));
  const ok = settled
    .filter((s): s is PromiseFulfilledResult<Partial<CopyResult>> => s.status === 'fulfilled')
    .map((s) => s.value);

  // Only fail the whole request if EVERY chunk failed; otherwise merge what succeeded.
  if (ok.length === 0) {
    const reason = (settled.find((s) => s.status === 'rejected') as PromiseRejectedResult | undefined)?.reason;
    if (reason instanceof Error && reason.message === REFUSAL) {
      return NextResponse.json(
        { error: 'The model declined this request. Try again or adjust your details.' },
        { status: 422 },
      );
    }
    const msg =
      reason instanceof Anthropic.APIError ? `${reason.status ?? ''} ${reason.message}`.trim()
      : reason instanceof Error ? reason.message
      : 'Copy request failed.';
    return NextResponse.json({ error: `Claude request failed: ${msg}` }, { status: 502 });
  }

  const copy: Partial<CopyResult> = Object.assign({}, ...ok);

  // Build the overlay for ONLY the requested sections so unselected content is left untouched.
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

  return NextResponse.json({ generated });
}
