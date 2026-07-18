'use client';

// Inline-editing primitive for the studio's Finalize live preview.
//
// Catalog components wrap each content-derived string in <E p="hero.headline">{value}</E>.
// This studio copy is interactive ONLY when rendered inside an <EditProvider> (the Finalize
// live preview). Everywhere else (the category-browse tabs) there is no provider, so <E>
// renders its children as static text — but still applies any per-element style override.
//
// The TEMPLATE repo ships a passthrough version of this same module
// (template/src/lib/editable.tsx) that applies overrides from the baked-in CONTENT. Because
// catalog component source is copied verbatim into client repos at export time, those repos
// resolve @/lib/editable to the passthrough and build clean — no editing scaffolding ships.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { getPath } from '@/lib/merge';
import type { ElementStyle } from '@/data/site';

type Ctx = {
  enabled: boolean;
  setField: (path: string, value: unknown) => void;
  overrides?: Record<string, unknown>;
  onSelect?: (path: string, el: HTMLElement) => void;
};
const EditCtx = createContext<Ctx | null>(null);

export function EditProvider({
  setField,
  overrides,
  onSelect,
  children,
}: {
  setField: (p: string, v: unknown) => void;
  overrides?: Record<string, unknown>;
  onSelect?: (path: string, el: HTMLElement) => void;
  children: ReactNode;
}) {
  return (
    <EditCtx.Provider value={{ enabled: true, setField, overrides, onSelect }}>
      {children}
    </EditCtx.Provider>
  );
}

/** True only inside an EditProvider (the Finalize live preview). Passthrough lib returns false. */
export function useEditing(): boolean {
  return useContext(EditCtx)?.enabled ?? false;
}

function styleFor(o?: ElementStyle): CSSProperties | undefined {
  if (!o) return undefined;
  const s: CSSProperties = {};
  if (o.color) s.color = o.color;
  if (o.fontSize) s.fontSize = `${o.fontSize}px`;
  if (o.fontWeight) s.fontWeight = o.fontWeight;
  return Object.keys(s).length ? s : undefined;
}

/**
 * Inline-editable text bound to a content path. `children` MUST be the plain string value at
 * `p`. Commits on blur (or Enter for single-line `fit` slots) to avoid contentEditable
 * cursor-jump. With `fit`, the font size steps down so a longer string still fits its box
 * (skipped when the user pinned an explicit fontSize override).
 */
export function E({
  p,
  children,
  fit,
}: {
  p: string;
  children: ReactNode;
  fit?: boolean;
}) {
  const ctx = useContext(EditCtx);
  const ref = useRef<HTMLSpanElement>(null);
  const text = typeof children === 'string' ? children : String(children ?? '');
  const override = ctx ? (getPath(ctx.overrides, p) as ElementStyle | undefined) : undefined;
  const style = styleFor(override);
  const hasSizeOverride = Boolean(override?.fontSize);

  // Keep the DOM text in sync with props, but never while the user is typing in this node
  // (that would reset the caret). Uncontrolled-on-focus, controlled-on-blur.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== text) el.textContent = text;
  }, [text]);

  // Auto-fit: shrink font-size until the text fits its container (single-line slots only).
  useEffect(() => {
    const el = ref.current;
    if (!el || !fit || hasSizeOverride) return;
    el.style.fontSize = '';
    const max = parseFloat(getComputedStyle(el).fontSize);
    let size = max;
    const floor = max * 0.6;
    let guard = 24;
    while (el.scrollWidth > el.clientWidth && size > floor && guard-- > 0) {
      size -= max * 0.04;
      el.style.fontSize = `${size}px`;
    }
  }, [text, fit, hasSizeOverride]);

  if (!ctx?.enabled || !p) return <span style={style}>{children}</span>;

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      data-edit-path={p}
      style={style}
      className="cursor-text rounded-sm outline-none transition-colors focus:bg-amber-50 focus:ring-1 focus:ring-amber-300 hover:bg-amber-50/40"
      onFocus={(e) => ctx.onSelect?.(p, e.currentTarget)}
      onBlur={(e) => ctx.setField(p, e.currentTarget.textContent ?? '')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && fit) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          e.currentTarget.textContent = text;
          e.currentTarget.blur();
        }
      }}
    >
      {children}
    </span>
  );
}
