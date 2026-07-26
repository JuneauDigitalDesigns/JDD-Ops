'use client';

import { useEffect, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X, PencilSimple } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { Section } from '@/lib/copy-schema';
import { labelFor, SECTION_ICONS } from '@/lib/section-labels';
import { EASE } from '@/lib/motion';

/**
 * Read-only "review brand copy" modal for the Intake step. Renders a single section's copy in
 * an EDITORIAL reader layout — natural hierarchy (eyebrow / headline / sub / CTA chips / cards),
 * NOT a form — so a reviewer grasps it at a glance. Neutral cream styling (not the client's
 * brand skin). Editing happens in Studio via the footer jump. Chrome mirrors LaunchDialog.
 */
export default function SectionCopyModal({
  section, content, isGenerated, onClose, onEditInStudio,
}: {
  section: Section;
  content: SiteContent;
  isGenerated: boolean;
  onClose: () => void;
  onEditInStudio: (s: Section) => void;
}) {
  const reduce = useReducedMotion();
  const Icon = SECTION_ICONS[section];

  // Esc closes; lock background scroll while open (matches FullScreenPreview).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.18 }}
        onClick={onClose}
        className="absolute inset-0 bg-[var(--fg)]/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduce ? 0 : 8, scale: reduce ? 1 : 0.98 }}
        transition={{ duration: reduce ? 0 : 0.22, ease: EASE }}
        role="dialog"
        aria-modal="true"
        aria-label={`Review ${labelFor(section)} copy`}
        className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-rule bg-panel shadow-overlay"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-rule px-6 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-rule bg-surface text-accent">
            <Icon size={18} weight="regular" />
          </span>
          <h2 className="font-display text-2xl font-semibold text-fg">{labelFor(section)}</h2>
          <span className={isGenerated ? 'badge badge-accent' : 'badge'}>
            {isGenerated ? 'AI-generated' : 'Preset copy'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <Body section={section} content={content} />
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-rule px-6 py-4">
          <span className="text-xs text-fg3">Read-only · edit on the live page in Studio</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn btn-sm">Close</button>
            <button
              type="button"
              onClick={() => { onEditInStudio(section); onClose(); }}
              className="btn btn-sm btn-primary"
            >
              <PencilSimple size={15} /> Edit in Studio
            </button>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}

/* ── Presentational helpers ───────────────────────────────────────────────── */

const has = (s?: string | null) => Boolean(s && s.trim());
const NotSet = () => <span className="italic text-fg3">Not set</span>;

function Eyebrow({ children }: { children?: string | null }) {
  if (!has(children)) return null;
  return <p className="font-chromeMono text-[11px] font-medium uppercase tracking-widest text-accent">{children}</p>;
}

function Headline({ text, emphasis, size = 'text-3xl' }: { text?: string | null; emphasis?: string | null; size?: string }) {
  const cls = `font-display ${size} font-semibold leading-tight text-fg`;
  if (!has(text)) return <p className={cls}><NotSet /></p>;
  if (emphasis && text!.includes(emphasis)) {
    const i = text!.indexOf(emphasis);
    return (
      <p className={cls}>
        {text!.slice(0, i)}<span className="text-accent">{emphasis}</span>{text!.slice(i + emphasis.length)}
      </p>
    );
  }
  return <p className={cls}>{text}</p>;
}

function Prose({ children, muted }: { children?: string | null; muted?: boolean }) {
  if (!has(children)) return <p className="text-sm text-fg2"><NotSet /></p>;
  return <p className={`whitespace-pre-line text-sm leading-relaxed ${muted ? 'text-fg3' : 'text-fg2'}`}>{children}</p>;
}

function CtaChip({ label, primary }: { label?: string | null; primary?: boolean }) {
  if (!has(label)) return null;
  return (
    <span className={[
      'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium',
      primary ? 'bg-accent text-[var(--accent-ink)]' : 'border border-ruleStrong text-fg2',
    ].join(' ')}>
      {label}
    </span>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-rule bg-surface p-4">{children}</div>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-chromeMono text-2xs uppercase tracking-widest text-fg3">{title}</p>
      {children}
    </div>
  );
}

function Chips({ items }: { items?: Array<string | null | undefined> }) {
  const list = (items ?? []).filter((x): x is string => has(x));
  if (!list.length) return <p className="text-sm italic text-fg3">None yet</p>;
  return <div className="flex flex-wrap gap-1.5">{list.map((t, i) => <span key={i} className="badge">{t}</span>)}</div>;
}

function KV({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-chromeMono text-2xs uppercase tracking-widest text-fg3">{label}</span>
      {has(value)
        ? <span className={mono ? 'codechip' : 'text-sm text-fg2'}>{value}</span>
        : <NotSet />}
    </div>
  );
}

function Stars({ n }: { n: number }) {
  const c = Math.max(0, Math.min(5, Math.round(n || 0)));
  return <span className="text-sm text-accent" aria-label={`${c} of 5 stars`}>{'★'.repeat(c)}<span className="text-fg3">{'★'.repeat(5 - c)}</span></span>;
}

/* ── Per-section editorial render ─────────────────────────────────────────── */

function Body({ section, content }: { section: Section; content: SiteContent }) {
  switch (section) {
    case 'hero': {
      const h = content.hero;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow>{h.eyebrow}</Eyebrow>
            <Headline text={h.headline} emphasis={h.headlineEmphasis} />
            <Prose>{h.sub}</Prose>
          </div>
          <div className="flex flex-wrap gap-2">
            <CtaChip label={h.cta} primary />
            <CtaChip label={h.secondaryCta} />
          </div>
          {(has(h.trust) || has(h.badge)) && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-fg3">
              {has(h.badge) && <span className="badge badge-accent">{h.badge}</span>}
              {has(h.trust) && <span>{h.trust}</span>}
            </div>
          )}
          {h.frictionReducers?.length > 0 && (
            <Group title="Friction reducers"><Chips items={h.frictionReducers} /></Group>
          )}
          {h.heroBullets?.length > 0 && (
            <Group title="Hero bullets">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {h.heroBullets.map((b, i) => (
                  <Card key={i}>
                    <p className="font-display text-2xl font-semibold text-fg">{has(b.value) ? b.value : '—'}</p>
                    <p className="text-xs text-fg3">{b.label}</p>
                  </Card>
                ))}
              </div>
            </Group>
          )}
        </div>
      );
    }
    case 'about': {
      const a = content.about;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow>{a.eyebrow}</Eyebrow>
            <Headline text={a.title} />
            <Prose>{a.body}</Prose>
          </div>
          {a.pillars?.length > 0 && (
            <Group title="Pillars">
              <div className="grid gap-3 sm:grid-cols-2">
                {a.pillars.map((p, i) => (
                  <Card key={i}>
                    <p className="font-display text-lg font-semibold text-fg">{has(p.t) ? p.t : <NotSet />}</p>
                    <p className="mt-1 text-sm text-fg2">{has(p.d) ? p.d : <NotSet />}</p>
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
                    <p className="font-display text-2xl font-semibold text-fg">{has(s.n) ? s.n : '—'}</p>
                    <p className="text-xs text-fg3">{s.l}</p>
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
            <Eyebrow>{s.eyebrow}</Eyebrow>
            <Headline text={s.title} />
            <Prose>{s.sub}</Prose>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.items?.length > 0
              ? s.items.map((it, i) => (
                <Card key={i}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg font-semibold text-fg">{has(it.t) ? it.t : <NotSet />}</p>
                    {has(it.tag) && <span className="badge shrink-0">{it.tag}</span>}
                  </div>
                  <p className="mt-1 text-sm text-fg2">{has(it.d) ? it.d : <NotSet />}</p>
                </Card>
              ))
              : <p className="text-sm italic text-fg3">No services yet</p>}
          </div>
        </div>
      );
    }
    case 'work': {
      const w = content.work;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow>{w.eyebrow}</Eyebrow>
            <Headline text={w.title} />
            <Prose>{w.sub}</Prose>
            {w.hidden && <p className="text-xs italic text-fg3">This section is hidden on the live site.</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {w.projects?.length > 0
              ? w.projects.map((p, i) => (
                <Card key={i}>
                  <p className="font-display text-lg font-semibold text-fg">{has(p.t) ? p.t : <NotSet />}</p>
                  <p className="mt-0.5 font-chromeMono text-xs text-fg3">
                    {[p.loc, p.yr, p.scope, p.size].filter(has).join(' · ') || '—'}
                  </p>
                  {has(p.caption) && <p className="mt-2 text-sm text-fg2">{p.caption}</p>}
                </Card>
              ))
              : <p className="text-sm italic text-fg3">No projects yet</p>}
          </div>
        </div>
      );
    }
    case 'testimonials': {
      const t = content.testimonials;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow>{t.eyebrow}</Eyebrow>
            <Headline text={t.title} />
          </div>
          <div className="space-y-3">
            {t.items?.length > 0
              ? t.items.map((it, i) => (
                <Card key={i}>
                  {typeof it.stars === 'number' && <Stars n={it.stars} />}
                  <p className="mt-1 font-display text-lg leading-snug text-fg">“{has(it.q) ? it.q : '…'}”</p>
                  <p className="mt-2 text-sm text-fg3">
                    {[it.a, it.r].filter(has).join(' · ')}{has(it.company) ? ` — ${it.company}` : ''}
                  </p>
                </Card>
              ))
              : <p className="text-sm italic text-fg3">No testimonials yet</p>}
          </div>
        </div>
      );
    }
    case 'faq': {
      const f = content.faq;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow>{f.eyebrow}</Eyebrow>
            <Headline text={f.title} />
            <Prose>{f.sub}</Prose>
          </div>
          <div className="divide-y divide-rule/60 rounded-xl border border-rule bg-surface">
            {f.items?.length > 0
              ? f.items.map((it, i) => (
                <div key={i} className="p-4">
                  <p className="text-sm font-semibold text-fg">{has(it.q) ? it.q : <NotSet />}</p>
                  <p className="mt-1 text-sm text-fg2">{has(it.a) ? it.a : <NotSet />}</p>
                </div>
              ))
              : <p className="p-4 text-sm italic text-fg3">No questions yet</p>}
          </div>
        </div>
      );
    }
    case 'finalCta': {
      const c = content.finalCta;
      return (
        <div className="space-y-5">
          <div className="space-y-3">
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <Headline text={c.headline} />
            <Prose>{c.sub}</Prose>
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
          <Prose>{f.blurb}</Prose>
          {f.cols?.length > 0 && (
            <Group title="Link columns">
              <div className="grid gap-3 sm:grid-cols-2">
                {f.cols.map((col, i) => (
                  <Card key={i}>
                    <p className="font-display text-base font-semibold text-fg">{has(col.h) ? col.h : <NotSet />}</p>
                    <ul className="mt-2 space-y-1">
                      {col.links?.map((l, j) => <li key={j} className="text-sm text-fg2">{l.label}</li>)}
                    </ul>
                  </Card>
                ))}
              </div>
            </Group>
          )}
          {f.social?.length > 0 && <Group title="Social"><Chips items={f.social.map((s) => s.label)} /></Group>}
          {f.legalLinks?.length > 0 && <Group title="Legal links"><Chips items={f.legalLinks.map((s) => s.label)} /></Group>}
          {has(f.legal) && <Group title="Legal"><Prose muted>{f.legal}</Prose></Group>}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <KV label="Google Analytics ID" value={s.googleAnalyticsId} mono />
            <KV label="Facebook Pixel ID" value={s.facebookPixelId} mono />
          </div>
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
    case 'announcement': {
      const a = content.announcement;
      return (
        <div className="rounded-xl border border-rule bg-surface p-4">
          {has(a) ? <p className="text-sm text-fg">{a}</p> : <p className="text-sm italic text-fg3">No announcement set — the bar is hidden.</p>}
        </div>
      );
    }
    case 'brand': {
      const b = content.brand;
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Headline text={b.name} size="text-2xl" />
            <Prose>{b.tagline}</Prose>
          </div>
          <Prose>{b.short}</Prose>
          <div className="grid gap-4 sm:grid-cols-2">
            <KV label="Phone" value={b.phone} />
            <KV label="Email" value={b.email} />
            <KV label="Address" value={b.address} />
            <KV label="License" value={b.license} />
          </div>
        </div>
      );
    }
    default:
      return <p className="text-sm italic text-fg3">Nothing to review for this section.</p>;
  }
}
