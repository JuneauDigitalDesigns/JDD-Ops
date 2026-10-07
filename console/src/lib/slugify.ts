/**
 * Brand name to folder slug. Client-safe on purpose: the convert dialog needs it in the browser,
 * and leadConversion.ts is `server-only`.
 *
 * Must match the agency site intake's slugifyBrand exactly, or the two sides won't line up.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}
