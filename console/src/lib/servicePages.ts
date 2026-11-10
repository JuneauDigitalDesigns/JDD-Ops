/**
 * Which services earn their own page, their URL slugs, and the one city their pages name
 * (service-page-spec.md §1, §2; Xander's per-service pages, 2026-11-10).
 *
 * The rule lives in exactly one place, @jdd/schema (src/service-pages.ts), so the console, the
 * agency onboarding wizard and the export can never disagree about which services get a page.
 * This file only re-exports it, so console code keeps importing '@/lib/servicePages'.
 * test/service-page-gate.test.mjs pins that it holds no logic of its own.
 *
 * Client repos can't import @jdd/schema, so lib/serviceLinks.ts keeps a runtime twin of
 * serviceSlugs and primaryCity; test/service-pages.test.mjs pins it to these.
 */
export {
  serviceSlug,
  serviceSlugs,
  servicePageFacts,
  qualifiesForServicePage,
  pickServicePages,
  primaryCity,
  INCLUDED_MIN,
  TYPICAL_JOBS_MIN,
  FACTS_MIN,
} from '@jdd/schema';
export type { ServiceFact } from '@jdd/schema';
