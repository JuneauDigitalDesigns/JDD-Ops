import type { Metadata } from 'next';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'seo-default',
  category: 'seo',
  label: 'SEO / Default (title + description + canonical)',
  consumes: ['seo.title', 'seo.description', 'seo.canonical', 'seo.googleAnalyticsId', 'seo.facebookPixelId', 'brand.name'],
  sharedDeps: [],
} as const;

export function generateMetadata(): Metadata {
  const { seo, brand } = CONTENT;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: seo.canonical,
      siteName: brand.name,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
    },
  };
}

export default function SeoDefault() {
  const { seo } = CONTENT;
  return (
    <>
      {seo.googleAnalyticsId && (
        <>
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${seo.googleAnalyticsId}`}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${seo.googleAnalyticsId}');`,
            }}
          />
        </>
      )}
      {seo.facebookPixelId && (
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${seo.facebookPixelId}');fbq('track','PageView');`,
          }}
        />
      )}
    </>
  );
}
