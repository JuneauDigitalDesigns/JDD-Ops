/**
 * The shape rule for a Site ID chosen on a sales call. Client-safe, so the Order step can say
 * "✓ Available" as you type and the server can refuse the same things.
 *
 * Stricter than `isValidSlug` (which allows `_` and capitals for older clients): lowercase
 * letters, digits and single hyphens only. Vercel REMOVES characters that aren't valid in a DNS
 * label rather than substituting them, so an underscore in a slug silently breaks every host
 * derived from it (CLAUDE.md, "Twilio ownership"). Same rule as the agency's order validation.
 *
 * Returns a reason when the ID is unusable, or null when its shape is fine.
 */
export function checkSiteId(slug: string): string | null {
  if (!slug) return 'Enter a Site ID.';
  if (slug.length > 60) return 'Keep the Site ID under 60 characters.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return 'Use lowercase letters, numbers and single hyphens.';
  }
  return null;
}
