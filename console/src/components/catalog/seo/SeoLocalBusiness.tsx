import type { Metadata } from 'next';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'seo-local-business',
  category: 'seo',
  label: 'SEO / Local Business (metadata + JSON-LD)',
  consumes: ['seo', 'brand.name', 'brand.long', 'brand.phone', 'brand.email', 'brand.address', 'brand.established', 'extensions.reviewBadge', 'extensions.hours', 'extensions.contactDetails'],
  sharedDeps: [],
} as const;

export function generateMetadata(): Metadata {
  const { seo, brand } = CONTENT;
  return {
    title: seo.title || brand.name,
    description: seo.description || brand.tagline,
    alternates: { canonical: seo.canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: seo.title || brand.name,
      description: seo.description || brand.tagline,
      url: seo.canonical,
      siteName: brand.name,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title || brand.name,
      description: seo.description || brand.tagline,
    },
  };
}

export default function SeoLocalBusiness() {
  const { brand, seo, extensions } = CONTENT;
  const review = extensions.reviewBadge;
  const hours = extensions.hours;
  const contact = extensions.contactDetails;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: brand.long || brand.name,
    description: seo.description || brand.tagline,
    telephone: brand.phone,
    email: brand.email,
    address: contact
      ? { '@type': 'PostalAddress', streetAddress: contact.address }
      : { '@type': 'PostalAddress', streetAddress: brand.address },
    ...(seo.canonical ? { url: seo.canonical } : {}),
    ...(brand.established ? { foundingDate: brand.established } : {}),
    ...(review
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: String(review.rating),
            reviewCount: String(review.count),
          },
        }
      : {}),
    ...(hours
      ? {
          openingHoursSpecification: Object.entries(hours).map(([day, time]) => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: day,
            opens: time.split('-')[0]?.trim() ?? time,
            closes: time.split('-')[1]?.trim() ?? time,
          })),
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
