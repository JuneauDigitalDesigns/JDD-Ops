'use client';

import { type ReactNode } from 'react';

/**
 * Editorial reader primitives for displaying SiteContent copy — eyebrow / headline / sub /
 * CTA chips / cards — promoted here from the deleted SectionCopyBody.tsx (its per-section
 * `switch` bodies are CopyWireframe.tsx's starting point) so both the wireframe and any
 * future reader-style surface share one copy instead of two.
 *
 * Uses console-chrome tokens exclusively (uiInk/uiAccent/uiCardRule/uiSurface/uiFg*), never
 * the bare rule/accent/bg/ink aliases — SectionCopyBody used those directly (`text-accent`,
 * `border-rule`, `.badge-accent`), which is exactly the class of bug the intake rebuild's
 * D3 defect names: `/build` sits inside the `.studio-chrome` scope, where `--accent` and
 * `--rule` are the CLIENT's brand colors, not the console's. `.badge`'s base class is safe
 * (it resolves through `--rule-strong`/`--fg-2`/`--surface`, none of which `.studio-chrome`
 * touches) but its `-accent` modifier isn't, so accent tinting here is done with an inline
 * style against `--ui-accent` instead of the `.badge-accent` class.
 */

export const hasText = (s?: string | null) => Boolean(s && s.trim());

export function NotSet() {
  return <span className="italic text-uiInkSoft">Not set</span>;
}

/**
 * Only a plain-string child hides for emptiness — CopyWireframe passes an <E>-wrapped editable
 * span, which must always render as a click-into slot even when the underlying value is ''.
 */
export function Eyebrow({ children }: { children?: ReactNode }) {
  if (typeof children === 'string' && !hasText(children)) return null;
  return <p className="font-chromeMono text-[11px] font-medium uppercase tracking-widest text-uiAccent">{children}</p>;
}

export function Headline({
  text, emphasis, size = 'text-3xl',
}: { text?: string | null; emphasis?: string | null; size?: string }) {
  const cls = `font-display ${size} font-semibold leading-tight text-uiInk`;
  if (!hasText(text)) return <p className={cls}><NotSet /></p>;
  if (emphasis && text!.includes(emphasis)) {
    const i = text!.indexOf(emphasis);
    return (
      <p className={cls}>
        {text!.slice(0, i)}<span className="text-uiAccent">{emphasis}</span>{text!.slice(i + emphasis.length)}
      </p>
    );
  }
  return <p className={cls}>{text}</p>;
}

export function Prose({ children, muted }: { children?: string | null; muted?: boolean }) {
  if (!hasText(children)) return <p className="text-sm text-uiFg2"><NotSet /></p>;
  return <p className={`whitespace-pre-line text-sm leading-relaxed ${muted ? 'text-uiFg3' : 'text-uiFg2'}`}>{children}</p>;
}

export function CtaChip({ label, primary }: { label?: string | null; primary?: boolean }) {
  if (!hasText(label)) return null;
  return (
    <span
      className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium"
      style={primary
        ? { background: 'var(--ui-accent)', color: 'var(--ui-accent-ink)' }
        : { border: '1px solid var(--ui-rule-strong)', color: 'var(--ui-fg-2)' }}
    >
      {label}
    </span>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-uiCardRule bg-uiSurface p-4">{children}</div>;
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-chromeMono text-2xs uppercase tracking-widest text-uiFg3">{title}</p>
      {children}
    </div>
  );
}

export function Chips({ items }: { items?: Array<string | null | undefined> }) {
  const list = (items ?? []).filter((x): x is string => hasText(x));
  if (!list.length) return <p className="text-sm italic text-uiFg3">None yet</p>;
  return <div className="flex flex-wrap gap-1.5">{list.map((t, i) => <span key={i} className="badge">{t}</span>)}</div>;
}

export function KV({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-chromeMono text-2xs uppercase tracking-widest text-uiFg3">{label}</span>
      {hasText(value)
        ? mono
          ? <span className="inline-block w-fit break-all rounded border border-uiCardRule bg-uiSurface2 px-1.5 py-0.5 font-chromeMono text-xs text-uiFg2">{value}</span>
          : <span className="text-sm text-uiFg2">{value}</span>
        : <NotSet />}
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  const c = Math.max(0, Math.min(5, Math.round(n || 0)));
  return (
    <span className="text-sm text-uiAccent" aria-label={`${c} of 5 stars`}>
      {'★'.repeat(c)}<span className="text-uiFg3">{'★'.repeat(5 - c)}</span>
    </span>
  );
}
