import {
  Sun, Users, ListChecks, Briefcase, Star, Question, Megaphone, Article, Code,
  SealCheck, TextT, type Icon,
} from '@phosphor-icons/react';
import type { Section } from '@/lib/copy-schema';

// Readable labels for section ids (camelCase / initialisms don't prettify cleanly).
// Shared by the Intake checklist and the review-copy modal so they stay in sync.
export const SECTION_LABELS: Partial<Record<Section, string>> = {
  brand: 'Brand', announcement: 'Announcement', trust: 'Trust', hero: 'Hero', about: 'About',
  services: 'Services', work: 'Work', testimonials: 'Testimonials', faq: 'FAQ',
  finalCta: 'Final CTA', footer: 'Footer', seo: 'SEO',
};

export const labelFor = (s: Section) =>
  SECTION_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

// Section → phosphor icon, mirroring the Studio category icons (see categories.tsx).
export const SECTION_ICONS: Record<Section, Icon> = {
  brand: TextT,
  announcement: Megaphone,
  trust: SealCheck,
  hero: Sun,
  about: Users,
  services: ListChecks,
  work: Briefcase,
  testimonials: Star,
  faq: Question,
  finalCta: Megaphone,
  footer: Article,
  seo: Code,
};
