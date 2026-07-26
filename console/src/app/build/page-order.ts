import type { SkinId } from '@/lib/skins';

// Page composition model. This used to live inside StudioApp.tsx (the old step-3 browser),
// which meant unrelated modules imported a component file just to get its types. StudioApp
// and FinalizePanel were merged into StudioStep; the model outlived both, so it lives here.

// The standard page sequence for body sections. `seo` is non-visual (wired as
// generateMetadata) and is deliberately excluded from the body order.
export const CANONICAL_ORDER = [
  'nav', 'hero', 'trust', 'about', 'services', 'work',
  'testimonials', 'faq', 'finalCta', 'contact', 'footer',
] as const;

// Nav is pinned to the top of the page, Footer to the bottom; everything else
// reorders freely between them.
const PIN_FIRST = 'nav';
const PIN_LAST = 'footer';

export type Selections = Record<string, string>; // categoryId -> componentName
export type SkinSelections = Record<string, SkinId>; // categoryId -> chosen skin

/** Keep nav first and footer last, preserving the order of everything in between. */
export function enforcePins(arr: string[]): string[] {
  const middle = arr.filter((id) => id !== PIN_FIRST && id !== PIN_LAST);
  return [
    ...(arr.includes(PIN_FIRST) ? [PIN_FIRST] : []),
    ...middle,
    ...(arr.includes(PIN_LAST) ? [PIN_LAST] : []),
  ];
}

/**
 * Produce a clean body order from the current selections, preserving any existing
 * user-chosen sequence: keep still-selected entries in place, insert newly-selected
 * categories at their canonical slot position, then pin nav/footer.
 */
export function reconcileOrder(prevOrder: string[], selections: Selections): string[] {
  const selectedBody: string[] = CANONICAL_ORDER.filter((id) => selections[id]);
  const next = prevOrder.filter((id) => selectedBody.includes(id));
  for (const id of selectedBody) {
    if (next.includes(id)) continue;
    const canonIdx = CANONICAL_ORDER.indexOf(id as typeof CANONICAL_ORDER[number]);
    let insertAt = next.length;
    for (let i = 0; i < next.length; i++) {
      if (CANONICAL_ORDER.indexOf(next[i] as typeof CANONICAL_ORDER[number]) > canonIdx) {
        insertAt = i;
        break;
      }
    }
    next.splice(insertAt, 0, id);
  }
  return enforcePins(next);
}
