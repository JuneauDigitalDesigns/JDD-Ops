'use client';

import type { SiteContent } from '@/data/site';
import type { Section } from '@/lib/copy-schema';
import { labelFor } from '@/lib/section-labels';
import { EditProvider, E } from '@/lib/editable';
import {
  Eyebrow, Headline, Prose, CtaChip, Card, Group, Chips, KV, Stars, hasText, NotSet,
} from './copy-primitives';

/**
 * The Review stage's wireframe: every generatable section, in real page order, as neutral
 * grey blocks — a proof the copy hangs together, not a design preview (no client palette, no
 * component skins; Studio is where that happens). Copy is click-to-edit via the same <E>
 * primitive the Studio preview uses, writing straight through setField.
 *
 * Order: brand and seo bookend the page-content sections as "site info" / "metadata" cards
 * — neither has a real position on the page itself, unlike everything between them, which
 * follows page-order.ts's CANONICAL_ORDER (skipping nav/contact, which aren't copy).
 */
const WIREFRAME_ORDER: Section[] = [
  'brand', 'announcement', 'hero', 'trust', 'about', 'services', 'work',
  'testimonials', 'faq', 'finalCta', 'footer', 'seo',
];

export interface SectionVerdict {
  ticked: boolean;
  canRevert: boolean;
  onAccept: () => void;
  onReroll: () => void;
  onRevert: () => void;
}

export default function CopyWireframe({
  content, setField, verdictFor,
}: {
  content: SiteContent;
  setField: (path: string, value: unknown) => void;
  /** One verdict-bar controller per section — built by IntakeStep, which owns the
   *  ticked/pre-run-snapshot state this needs. */
  verdictFor: (section: Section) => SectionVerdict;
}) {
  return (
    <EditProvider setField={setField}>
      <div className="mx-auto max-w-2xl space-y-6 pb-16">
        {WIREFRAME_ORDER.map((section) => (
          <SectionWireframeCard key={section} section={section} content={content} verdict={verdictFor(section)} />
        ))}
      </div>
    </EditProvider>
  );
}

function VerdictBar({ section, verdict }: { section: Section; verdict: SectionVerdict }) {
  return (
    <div className="mb-3 flex items-center gap-3 border-b border-uiCardRule pb-3">
      <span className="kicker">{labelFor(section)}</span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={verdict.onAccept}
          disabled={!verdict.ticked}
          title="Accept — stop re-generating this section"
          className="rounded-md px-2 py-1 font-chromeMono text-2xs uppercase tracking-wide text-uiInkSoft transition-colors hover:bg-uiSurface hover:text-uiInk disabled:cursor-default disabled:opacity-40"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={verdict.onReroll}
          title="Tick for regeneration and jump to the Prompt stage"
          className="rounded-md px-2 py-1 font-chromeMono text-2xs uppercase tracking-wide text-uiInkSoft transition-colors hover:bg-uiSurface hover:text-uiInk"
        >
          Re-roll
        </button>
        <button
          type="button"
          onClick={verdict.onRevert}
          disabled={!verdict.canRevert}
          title="Restore this section's value from before the last run"
          className="rounded-md px-2 py-1 font-chromeMono text-2xs uppercase tracking-wide text-uiInkSoft transition-colors hover:bg-uiSurface hover:text-uiInk disabled:cursor-default disabled:opacity-40"
        >
          Revert
        </button>
      </div>
    </div>
  );
}

function SectionWireframeCard({
  section, content, verdict,
}: { section: Section; content: SiteContent; verdict: SectionVerdict }) {
  return (
    <div className="rounded-xl border border-uiCardRule bg-uiBg p-5 shadow-raised">
      <VerdictBar section={section} verdict={verdict} />
      <SectionBody section={section} content={content} />
    </div>
  );
}

function SectionBody({ section, content }: { section: Section; content: SiteContent }) {
  switch (section) {
    case 'brand': {
      const b = content.brand;
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Headline text={b.name} size="text-2xl" />
            <p className="text-sm text-uiFg2"><E p="brand.tagline">{b.tagline}</E></p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <KV label="Phone" value={b.phone} />
            <KV label="Email" value={b.email} />
            <KV label="Address" value={b.address} />
            <KV label="License" value={b.license} />
          </div>
        </div>
      );
    }
    case 'announcement': {
      const a = content.announcement;
      return (
        <div className="rounded-lg border border-uiCardRule bg-uiSurface p-3">
          {hasText(a)
            ? <p className="text-sm text-uiFg"><E p="announcement">{a as string}</E></p>
            : <p className="text-sm italic text-uiFg3">No announcement set — the bar is hidden.</p>}
        </div>
      );
    }
    case 'hero': {
      const h = content.hero;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow><E p="hero.eyebrow">{h.eyebrow}</E></Eyebrow>
            {h.headlineEmphasis && h.headline.includes(h.headlineEmphasis) ? (
              <Headline text={h.headline} emphasis={h.headlineEmphasis} />
            ) : (
              <p className="font-display text-3xl font-semibold leading-tight text-uiInk"><E p="hero.headline" fit>{h.headline}</E></p>
            )}
            <p className="text-sm leading-relaxed text-uiFg2"><E p="hero.sub">{h.sub}</E></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CtaChip label={h.cta} primary />
            <CtaChip label={h.secondaryCta} />
          </div>
          {h.frictionReducers?.length > 0 && (
            <Group title="Friction reducers"><Chips items={h.frictionReducers} /></Group>
          )}
          {h.heroBullets?.length > 0 && (
            <Group title="Hero bullets">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {h.heroBullets.map((bpt, i) => (
                  <Card key={i}>
                    <p className="font-display text-2xl font-semibold text-uiInk"><E p={`hero.heroBullets.${i}.value`} fit>{bpt.value}</E></p>
                    <p className="text-xs text-uiFg3"><E p={`hero.heroBullets.${i}.label`}>{bpt.label}</E></p>
                  </Card>
                ))}
              </div>
            </Group>
          )}
        </div>
      );
    }
    case 'trust': {
      const t = content.trust;
      return (
        <div className="space-y-4">
          <KV label="Label" value={t.label} />
          <Group title="Logos"><Chips items={t.logos} /></Group>
        </div>
      );
    }
    case 'about': {
      const a = content.about;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow><E p="about.eyebrow">{a.eyebrow}</E></Eyebrow>
            <p className="font-display text-3xl font-semibold leading-tight text-uiInk"><E p="about.title" fit>{a.title}</E></p>
            <p className="text-sm leading-relaxed text-uiFg2"><E p="about.body">{a.body}</E></p>
          </div>
          {a.pillars?.length > 0 && (
            <Group title="Pillars">
              <div className="grid gap-3 sm:grid-cols-2">
                {a.pillars.map((p, i) => (
                  <Card key={i}>
                    <p className="font-display text-lg font-semibold text-uiInk">{hasText(p.t) ? <E p={`about.pillars.${i}.t`}>{p.t}</E> : <NotSet />}</p>
                    <p className="mt-1 text-sm text-uiFg2">{hasText(p.d) ? <E p={`about.pillars.${i}.d`}>{p.d}</E> : <NotSet />}</p>
                  </Card>
                ))}
              </div>
            </Group>
          )}
          {a.stats?.length > 0 && (
            <Group title="Stats">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {a.stats.map((s, i) => (
                  <Card key={i}>
                    <p className="font-display text-2xl font-semibold text-uiInk"><E p={`about.stats.${i}.n`} fit>{s.n}</E></p>
                    <p className="text-xs text-uiFg3"><E p={`about.stats.${i}.l`}>{s.l}</E></p>
                  </Card>
                ))}
              </div>
            </Group>
          )}
        </div>
      );
    }
    case 'services': {
      const s = content.services;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow><E p="services.eyebrow">{s.eyebrow}</E></Eyebrow>
            <p className="font-display text-3xl font-semibold leading-tight text-uiInk"><E p="services.title" fit>{s.title}</E></p>
            <p className="text-sm leading-relaxed text-uiFg2"><E p="services.sub">{s.sub}</E></p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.items?.length > 0
              ? s.items.map((it, i) => (
                <Card key={i}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg font-semibold text-uiInk">{hasText(it.t) ? <E p={`services.items.${i}.t`}>{it.t}</E> : <NotSet />}</p>
                    {hasText(it.tag) && <span className="badge shrink-0">{it.tag}</span>}
                  </div>
                  <p className="mt-1 text-sm text-uiFg2">{hasText(it.d) ? <E p={`services.items.${i}.d`}>{it.d}</E> : <NotSet />}</p>
                </Card>
              ))
              : <p className="text-sm italic text-uiFg3">No services yet</p>}
          </div>
        </div>
      );
    }
    case 'work': {
      const w = content.work;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow><E p="work.eyebrow">{w.eyebrow}</E></Eyebrow>
            <p className="font-display text-3xl font-semibold leading-tight text-uiInk"><E p="work.title" fit>{w.title}</E></p>
            <p className="text-sm leading-relaxed text-uiFg2"><E p="work.sub">{w.sub}</E></p>
            {w.hidden && <p className="text-xs italic text-uiFg3">This section is hidden on the live site.</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {w.projects?.length > 0
              ? w.projects.map((p, i) => (
                <Card key={i}>
                  <p className="font-display text-lg font-semibold text-uiInk">{hasText(p.t) ? <E p={`work.projects.${i}.t`}>{p.t}</E> : <NotSet />}</p>
                  <p className="mt-0.5 font-chromeMono text-xs text-uiFg3">
                    {[p.loc, p.yr, p.scope, p.size].filter(hasText).join(' · ') || '—'}
                  </p>
                  {hasText(p.caption) && <p className="mt-2 text-sm text-uiFg2"><E p={`work.projects.${i}.caption`}>{p.caption}</E></p>}
                </Card>
              ))
              : <p className="text-sm italic text-uiFg3">No projects yet</p>}
          </div>
        </div>
      );
    }
    case 'testimonials': {
      const t = content.testimonials;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow><E p="testimonials.eyebrow">{t.eyebrow}</E></Eyebrow>
            <p className="font-display text-3xl font-semibold leading-tight text-uiInk"><E p="testimonials.title" fit>{t.title}</E></p>
          </div>
          <div className="space-y-3">
            {t.items?.length > 0
              ? t.items.map((it, i) => (
                <Card key={i}>
                  {typeof it.stars === 'number' && <Stars n={it.stars} />}
                  <p className="mt-1 font-display text-lg leading-snug text-uiInk">&ldquo;{hasText(it.q) ? <E p={`testimonials.items.${i}.q`}>{it.q}</E> : '…'}&rdquo;</p>
                  <p className="mt-2 text-sm text-uiFg3">
                    <E p={`testimonials.items.${i}.a`}>{it.a}</E>{hasText(it.r) ? <> · <E p={`testimonials.items.${i}.r`}>{it.r}</E></> : null}
                    {hasText(it.company) ? <> — <E p={`testimonials.items.${i}.company`}>{it.company as string}</E></> : null}
                  </p>
                </Card>
              ))
              : <p className="text-sm italic text-uiFg3">No testimonials yet</p>}
          </div>
        </div>
      );
    }
    case 'faq': {
      const f = content.faq;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow><E p="faq.eyebrow">{f.eyebrow}</E></Eyebrow>
            <p className="font-display text-3xl font-semibold leading-tight text-uiInk"><E p="faq.title" fit>{f.title}</E></p>
            <p className="text-sm leading-relaxed text-uiFg2"><E p="faq.sub">{f.sub}</E></p>
          </div>
          <div className="divide-y divide-uiCardRule rounded-xl border border-uiCardRule bg-uiSurface">
            {f.items?.length > 0
              ? f.items.map((it, i) => (
                <div key={i} className="p-4">
                  <p className="text-sm font-semibold text-uiInk">{hasText(it.q) ? <E p={`faq.items.${i}.q`}>{it.q}</E> : <NotSet />}</p>
                  <p className="mt-1 text-sm text-uiFg2">{hasText(it.a) ? <E p={`faq.items.${i}.a`}>{it.a}</E> : <NotSet />}</p>
                </div>
              ))
              : <p className="p-4 text-sm italic text-uiFg3">No questions yet</p>}
          </div>
        </div>
      );
    }
    case 'finalCta': {
      const c = content.finalCta;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow><E p="finalCta.eyebrow">{c.eyebrow}</E></Eyebrow>
            <p className="font-display text-3xl font-semibold leading-tight text-uiInk"><E p="finalCta.headline" fit>{c.headline}</E></p>
            <p className="text-sm leading-relaxed text-uiFg2"><E p="finalCta.sub">{c.sub}</E></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CtaChip label={c.cta} primary />
            <CtaChip label={c.secondary} />
          </div>
          {c.frictionReducers?.length > 0 && (
            <Group title="Friction reducers"><Chips items={c.frictionReducers} /></Group>
          )}
        </div>
      );
    }
    case 'footer': {
      const f = content.footer;
      return (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-uiFg2"><E p="footer.blurb">{f.blurb}</E></p>
          {f.cols?.length > 0 && (
            <Group title="Link columns">
              <div className="grid gap-3 sm:grid-cols-2">
                {f.cols.map((col, i) => (
                  <Card key={i}>
                    <p className="font-display text-base font-semibold text-uiInk">{hasText(col.h) ? col.h : <NotSet />}</p>
                    <ul className="mt-2 space-y-1">
                      {col.links?.map((l, j) => <li key={j} className="text-sm text-uiFg2">{l.label}</li>)}
                    </ul>
                  </Card>
                ))}
              </div>
            </Group>
          )}
          {f.social?.length > 0 && <Group title="Social"><Chips items={f.social.map((s) => s.label)} /></Group>}
          {f.legalLinks?.length > 0 && <Group title="Legal links"><Chips items={f.legalLinks.map((s) => s.label)} /></Group>}
          {hasText(f.legal) && <Group title="Legal"><Prose muted>{f.legal}</Prose></Group>}
        </div>
      );
    }
    case 'seo': {
      const s = content.seo;
      return (
        <div className="space-y-4">
          <KV label="Title" value={s.title} />
          <KV label="Description" value={s.description} />
          <KV label="Canonical URL" value={s.canonical} mono />
        </div>
      );
    }
    default:
      return <p className="text-sm italic text-uiFg3">Nothing to review for this section.</p>;
  }
}
