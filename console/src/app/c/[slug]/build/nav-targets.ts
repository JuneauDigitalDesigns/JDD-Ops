// The single source of truth for which page sections a nav link can point at, and the
// anchor each one resolves to. Catalog section components render a DOM `id` on their root;
// a nav `href` of `#<id>` is what makes "click nav → scroll to section" work.
//
// Only these categories render an id today (hero/trust/footer/nav do not), so only these
// are offered as link targets. finalCta is deliberately `#cta`, NOT `#finalCta` — live
// client repos already ship that anchor, and changing it would break their existing nav.
//
// Keep this in lockstep with the DOM `id=` attributes in components/catalog/**. If a
// section's id changes there, change it here.

export type NavTarget = { categoryId: string; anchor: string; label: string };

const TARGETS: readonly NavTarget[] = [
  { categoryId: 'about', anchor: '#about', label: 'About' },
  { categoryId: 'services', anchor: '#services', label: 'Services' },
  { categoryId: 'work', anchor: '#work', label: 'Work' },
  { categoryId: 'testimonials', anchor: '#testimonials', label: 'Reviews' },
  { categoryId: 'faq', anchor: '#faq', label: 'FAQ' },
  { categoryId: 'contact', anchor: '#contact', label: 'Contact' },
  { categoryId: 'finalCta', anchor: '#cta', label: 'Book' },
] as const;

const BY_CATEGORY = new Map(TARGETS.map((t) => [t.categoryId, t]));
const BY_ANCHOR = new Map(TARGETS.map((t) => [t.anchor, t]));

/** The link targets that are actually on the page right now, in page order. */
export function linkableTargets(order: string[]): NavTarget[] {
  return order.map((id) => BY_CATEGORY.get(id)).filter((t): t is NavTarget => t !== undefined);
}

/**
 * True when `href` points at a KNOWN section anchor that is NOT currently on the page —
 * i.e. a link that will scroll to nothing. Non-section hrefs (external URLs, `#`, `#top`)
 * return false: they aren't ours to police and flagging them would be noise.
 */
export function isDanglingLink(href: string, order: string[]): boolean {
  const target = BY_ANCHOR.get(href.trim());
  if (!target) return false;
  return !order.includes(target.categoryId);
}
