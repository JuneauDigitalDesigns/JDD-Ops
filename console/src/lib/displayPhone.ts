/**
 * The phone as a site shows it: `(407) 555-0177`, with an E.164 `tel:` link.
 *
 * The onboarding form stores what the client typed, usually bare digits, and every template prints
 * `brand.phone` as is: Tracewell's test site read "4075550177" in its nav, hero, Contact and footer
 * (E2E-ONBOARDING-TEST-2026-11-10, F-D6). @jdd/schema v1.33.3 fixes it where new content is made
 * (buildScaffold stores it formatted). This applies the same function to content the console
 * already holds: every client imported before v1.33.3, and a number an operator types as digits.
 *
 * Where it runs: the Studio's preview content and the export, so what the operator sees is what
 * site.ts gets. Rendering is not the place: the number is printed in some 150 spots across the
 * catalog, and a client repo has no @jdd/schema to format with.
 *
 * Copy that quoted the stored number ("Call 4075550177", the old mapper's hero button) follows it.
 * A number toE164 can't read is shown as typed, never guessed at.
 */
import { formatPhoneDisplay, phoneHref, toE164 } from '@jdd/schema';

type Brand = { phone?: string | null; phoneHref?: string | null };

/** Every string in `v` with `from` replaced by `to`, skipping `tel:` hrefs. Returns `v` itself when nothing changed. */
function replaceIn<T>(v: T, from: string, to: string): T {
  if (typeof v === 'string') return (v.includes(from) && !v.startsWith('tel:') ? v.split(from).join(to) : v) as T;
  if (Array.isArray(v)) {
    const next = v.map((x) => replaceIn(x, from, to));
    return (next.some((x, i) => x !== v[i]) ? next : v) as T;
  }
  if (v && typeof v === 'object') {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      next[k] = replaceIn(x, from, to);
      if (next[k] !== x) changed = true;
    }
    return (changed ? next : v) as T;
  }
  return v;
}

export function withDisplayPhone<T extends { brand?: Brand | null }>(content: T): T {
  const brand = content.brand;
  if (!brand) return content;
  const raw = (brand.phone ?? '').trim();
  const phone = formatPhoneDisplay(raw);
  // The link dials the number it already names when that reads as one, else the shown number.
  const linked = (brand.phoneHref ?? '').replace(/^tel:/i, '').trim();
  const e164 = toE164(linked);
  const href = e164 ? `tel:${e164}` : linked ? (brand.phoneHref ?? '') : phoneHref(raw);
  if (phone === brand.phone && href === brand.phoneHref) return content;

  // Bare digits quoted elsewhere in the copy are the same number: show them the same way.
  const quoted = /^\+?\d{10,11}$/.test(raw) && raw !== phone ? replaceIn(content, raw, phone) : content;
  return { ...quoted, brand: { ...quoted.brand, phone, phoneHref: href } };
}
