// Jump to the editor for a dotted content path.
//
// Two surfaces expose paths as DOM attributes:
//   • the live preview — every inline <E> renders data-edit-path={p} (lib/editable.tsx)
//   • the brand drawer — its inputs render data-field-path
//
// The preview is the richer target: focusing an <E> also fires its onFocus, which the
// FinalizePanel wires to open the StyleToolbar on that element, so a jump composes with
// the existing style editor for free.
//
// Returns whether a target was found, so callers can explain a miss instead of silently
// doing nothing. A preview path only resolves when its section is in the current page
// order AND the catalog component wrapped that field in <E> — some deliberately don't
// (e.g. ServicesGrid's spotlight mirror is a plain read-only echo of the rail).

export type FocusSurface = 'preview' | 'drawer' | 'any';

function selectorFor(path: string, surface: FocusSurface): string {
  // CSS.escape guards paths containing characters that would break the attribute selector.
  const p = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(path) : path;
  const preview = `[data-edit-path="${p}"]`;
  const drawer = `[data-field-path="${p}"]`;
  if (surface === 'preview') return preview;
  if (surface === 'drawer') return drawer;
  return `${preview}, ${drawer}`;
}

export function findPathEl(path: string, surface: FocusSurface = 'any'): HTMLElement | null {
  if (typeof document === 'undefined' || !path) return null;
  return document.querySelector<HTMLElement>(selectorFor(path, surface));
}

/**
 * Expand any collapsed <details> between `el` and the document root.
 *
 * Accordion catalog components (FaqAccordion, ServicesAccordion) render their body inside
 * a closed <details>. The target is in the DOM and even reports a layout box, but it is
 * clipped to zero height by overflow:hidden wrappers — and focus() on zero-height clipped
 * content is a silent no-op. Opening the ancestors first is also the right behaviour:
 * jumping to an FAQ answer should reveal that answer.
 */
function revealAncestors(el: HTMLElement): void {
  let p: HTMLElement | null = el.parentElement;
  while (p) {
    if (p instanceof HTMLDetailsElement && !p.open) p.open = true;
    p = p.parentElement;
  }
}

export function focusPath(
  path: string,
  { surface = 'any', smooth = true }: { surface?: FocusSurface; smooth?: boolean } = {},
): boolean {
  const el = findPathEl(path, surface);
  if (!el) return false;

  revealAncestors(el);
  el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
  // preventScroll: scrollIntoView already positioned it; letting focus() scroll again
  // fights the smooth animation and lands off-center.
  el.focus({ preventScroll: true });

  // Being in the DOM is not the same as being focusable — a target inside a container the
  // component collapses by other means (height:0, hidden, inert) will refuse focus. Report
  // that as a miss so the caller can say so rather than appearing to do nothing.
  return document.activeElement === el;
}
