// Passthrough of the studio's inline-editing primitive for client repos.
//
// Catalog component source (copied verbatim from the studio at export time) imports
// `E` / `useEditing` / `EditProvider` from `@/lib/editable`. In a client repo there is no
// editing UI, so `useEditing()` is always false and `<EditProvider>` is a fragment. `<E>`
// applies any per-element style override baked into CONTENT.overrides for its path, so the
// color/size/weight tuned in the studio ship to the live site without any editing scaffolding.

import type { CSSProperties, ReactNode } from 'react';
import { CONTENT } from '@/data/site';
import type { ElementStyle } from '@/data/site';

function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function styleFor(o?: ElementStyle): CSSProperties | undefined {
  if (!o) return undefined;
  const s: CSSProperties = {};
  if (o.color) s.color = o.color;
  if (o.fontSize) s.fontSize = `${o.fontSize}px`;
  if (o.fontWeight) s.fontWeight = o.fontWeight;
  return Object.keys(s).length ? s : undefined;
}

export function E({ p, children }: { p?: string; children: ReactNode; fit?: boolean }) {
  const style = p ? styleFor(getPath(CONTENT.overrides, p) as ElementStyle | undefined) : undefined;
  return style ? <span style={style}>{children}</span> : <>{children}</>;
}

export function useEditing(): boolean {
  return false;
}

export function EditProvider({ children }: { setField?: unknown; children: ReactNode }) {
  return <>{children}</>;
}
