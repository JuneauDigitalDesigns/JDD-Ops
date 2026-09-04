import type { Section } from '@/lib/copy-schema';

// Readable labels for section ids (camelCase / initialisms don't prettify cleanly).
// Shared by the Intake checklist and the review-copy modal so they stay in sync.
//
// Deliberately no Phosphor icon components in this module (SECTION_ICONS used to live here,
// unused by anything and removed): copy-brief/resolve.ts imports labelFor and is now loaded
// by server-only API routes (estimate, generate-copy) as well as client components. A
// React-component import here broke both routes with "createContext is not a function" —
// @phosphor-icons/react pulls in client-runtime React internals the RSC/server bundle
// doesn't have, and ES modules bundle a file's imports whole regardless of which named export
// a caller actually uses. Keep this file pure data so it stays safe in either context.
export const SECTION_LABELS: Partial<Record<Section, string>> = {
  brand: 'Brand', announcement: 'Announcement', trust: 'Trust', hero: 'Hero', about: 'About',
  services: 'Services', work: 'Work', testimonials: 'Testimonials', faq: 'FAQ',
  finalCta: 'Final CTA', footer: 'Footer', seo: 'SEO',
};

export const labelFor = (s: Section) =>
  SECTION_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1);
