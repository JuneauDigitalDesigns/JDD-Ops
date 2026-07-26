// _meta.missing_fields helpers, lifted verbatim from IntakeReviewStep so the brand drawer
// can render the same amber "review" badge without duplicating the matching rules.
//
// Caveat worth knowing before relying on these: missing_fields holds *intake-form* paths,
// which only partly overlap SiteContent paths. Entries like "business.industry",
// "branding.palette", "social.linkedin" or a bare "existingWebsiteUrl" resolve to nothing
// here, and every vertical preset hardcodes an identical five-entry list. So treat a flag
// as an advisory "the intake didn't supply this", never as a completeness measure — for
// that, count real empty values via lib/fieldIndex.

/** Canonical spelling is snake_case (@jdd/schema ContentMeta.missing_fields). */
export function missingFields(meta: unknown): string[] {
  const m = meta as { missing_fields?: unknown; missingFields?: unknown } | undefined;
  const raw = m?.missing_fields ?? m?.missingFields;
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

/** Matches an exact path, an ancestor of it, or a descendant of it. */
export function isFieldFlagged(missing: string[], path: string): boolean {
  return missing.some((m) => path === m || path.startsWith(`${m}.`) || m.startsWith(`${path}.`));
}

/** Matches the prefix itself or anything beneath it (downward only). */
export function isSectionFlagged(missing: string[], prefix: string): boolean {
  return missing.some((m) => m === prefix || m.startsWith(`${prefix}.`));
}
