'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacPageHeader — Northstar page opener for Services, About, and Contact, premium pass
// (2026-11-09, approved mockup). The thin grey band became a NAVY band with the steel glow: steel
// eyebrow, a condensed H1 up to 64px, the sub, the CTA, and on desktop a photo on the right (the
// second hero slide under the navy wash) when the site has one. Copy is per-route:
// SiteContent.subpages[route].header, passed as `data` by wirePages. Studio sets editPrefix so the
// fields stay inline-editable. Every colour is a palette token.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type PageHeaderContent, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { imageAt } from '@/lib/localImage';

export const meta = {
  id: 'hvac-page-header',
  category: 'pageHeader',
  label: 'HVAC / Page header',
  consumes: ['subpages.*.header', 'images.hero.slides'],
  sharedDeps: ['@/lib/editable', '@/lib/localImage'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function HvacPageHeader({
  data,
  editPrefix,
  content = CONTENT,
}: {
  data: PageHeaderContent;
  editPrefix?: string;
  content?: SiteContent;
}) {
  const field = (name: string, value: string) =>
    editPrefix ? <E p={`${editPrefix}.${name}`}>{value}</E> : value;
  const slides = content.images.hero?.slides ?? [];
  const photo = slides[1] ?? slides[0];

  return (
    <section
      id="page-header"
      className="relative isolate overflow-hidden bg-inkPanel text-onInk"
      style={{
        background:
          'radial-gradient(900px 300px at 80% 0%, color-mix(in srgb, var(--accent-2-strong) 14%, transparent), transparent 60%),' +
          'var(--ink-panel)',
      }}
    >
      <div className={`mx-auto grid max-w-[1120px] items-center gap-8 px-5 py-12 sm:px-6 lg:py-[72px] ${photo ? 'lg:grid-cols-[1.1fr_0.9fr] lg:gap-12' : ''}`}>
        <div>
          {data.eyebrow ? (
            <p className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2-strong)]">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              {field('eyebrow', data.eyebrow)}
            </p>
          ) : null}
          <h1 className="mt-4 max-w-[18ch] font-heading text-[clamp(40px,4.8vw,64px)] font-medium leading-[1] tracking-[-0.015em] text-onInk">
            {field('title', data.title)}
          </h1>
          {data.sub ? (
            <p className="mt-4 max-w-[48ch] text-[17px] leading-[1.6] text-onInkSoft">
              {field('sub', data.sub)}
            </p>
          ) : null}
          {data.cta ? (
            <a
              href={data.cta.href}
              className="mt-7 inline-flex items-center rounded-[10px] bg-accent px-[22px] py-[14px] text-[16px] font-bold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
              style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 50%, transparent)' }}
            >
              {data.cta.label}
            </a>
          ) : null}
        </div>
        {photo && (
          <div
            className="shadow-brand-3 relative hidden aspect-[4/3] overflow-hidden rounded-[16px] bg-cover bg-center lg:block"
            style={{ backgroundImage: `url(${imageAt(photo.url, 1024)})` }}
            role="img"
            aria-label={photo.alt}
          >
            <div className="absolute inset-0 bg-[color:var(--accent-2)] opacity-45 mix-blend-color" aria-hidden="true" />
            <div
              className="absolute inset-0"
              aria-hidden="true"
              style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--ink-panel) 60%, transparent), transparent 50%)' }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
