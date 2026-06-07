import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Hardcoded allowlist of (category, name) pairs. Anything not in here is rejected.
// Prevents path traversal and constrains the route to known catalog entries.
const ALLOWED: Record<string, readonly string[]> = {
  nav:          ['NavMinimal', 'NavCentered', 'NavAnnouncementBar', 'NavSplitCta'],
  hero:         ['HeroSplit', 'HeroCentered', 'HeroSlideshow', 'HeroFormFocus'],
  trust:        ['TrustMarquee', 'TrustBadges', 'TrustLogoGrid', 'TrustBar'],
  about:        ['AboutPillars', 'AboutFeature', 'AboutStatBand', 'AboutStory'],
  services:     ['ServicesGrid', 'ServicesAccordion', 'ServicesPanel', 'ServicesShowcase'],
  work:         ['WorkCarousel', 'WorkGrid', 'WorkSpotlight', 'WorkMasonry'],
  faq:          ['FaqAccordion', 'FaqTwoColumn', 'FaqStickyAside', 'FaqCentered'],
  testimonials: ['TestimonialsGrid', 'TestimonialsCarousel', 'TestimonialsRotator', 'TestimonialsMarquee'],
  finalCta:     ['FinalCtaBanner', 'FinalCtaSimple', 'FinalCtaSplit', 'FinalCtaGradient'],
  contact:      ['ContactSplit', 'CtaBanner', 'ContactCardOverlap', 'ContactInlineStrip'],
  footer:       ['FooterColumns', 'FooterMinimal', 'FooterBrandCta', 'FooterMega'],
  seo:          ['SeoDefault', 'SeoLocalBusiness'],
} as const;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const name = url.searchParams.get('name');

  if (!category || !name) {
    return NextResponse.json({ error: 'Missing category or name.' }, { status: 400 });
  }
  const allowed = ALLOWED[category];
  if (!allowed || !allowed.includes(name)) {
    return NextResponse.json({ error: 'Unknown category or name.' }, { status: 400 });
  }

  const filePath = path.join(
    process.cwd(),
    'src',
    'components',
    'catalog',
    category,
    `${name}.tsx`,
  );

  try {
    const text = await readFile(filePath, 'utf8');
    return new NextResponse(text, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  } catch {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  }
}
