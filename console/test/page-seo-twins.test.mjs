// The client-repo half of per-page SEO (SEO plan D7, D9, D10). The console computes every page's
// title, description, canonical, OG image and JSON-LD at export (lib/pageSeo.ts) into
// src/data/seo-pages.ts; the repo only reads it. These guard the wiring between the two.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseExportedPage } from '../src/lib/readback-parse.ts';

const CONSOLE = fileURLToPath(new URL('..', import.meta.url));
const OPS = join(CONSOLE, '..');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

for (const f of ['src/lib/pageMetadata.ts', 'src/lib/PageJsonLd.tsx', 'src/data/seo-pages.ts']) {
  test(`${f} is byte-identical in the console and the template`, () => {
    // Catalog SEO components import these in the console preview AND in every client repo.
    assert.equal(read(join(OPS, 'template', f)), read(join(CONSOLE, f)));
  });
}

const exportSrc = () => read(join(CONSOLE, 'src/lib/export.ts'));

test('every generated page renders its own JSON-LD, and subpages take metadata from pageMetadata', () => {
  const s = exportSrc();
  assert.match(s, /import PageJsonLd from '@\/lib\/PageJsonLd';/);
  assert.match(s, /<PageJsonLd route=\{\$\{JSON\.stringify\(page\.route\)\}\} \/>/);
  assert.match(s, /export const metadata: Metadata = pageMetadata\(\$\{JSON\.stringify\(page\.route\)\}\);/);
  // The old literal metadata had no canonical, so subpages inherited home's from the layout.
  assert.ok(!/CONTENT\.subpages\?\.\[\$\{rk\}\]\?\.seo\?\.title/.test(s), 'subpage metadata still bypasses pageMetadata');
});

test('the JSON-LD line sits outside the Studio body markers, so read-back still parses the page', () => {
  const page = [
    "import PageJsonLd from '@/lib/PageJsonLd';",
    "import HvacNav from '@/components/catalog/nav/HvacNav';",
    "import HvacHero from '@/components/catalog/hero/HvacHero';",
    "import HvacFooter from '@/components/catalog/footer/HvacFooter';",
    '',
    "export { generateMetadata } from '@/components/catalog/seo/SeoLocalBusiness';",
    '',
    'export default function Page() {',
    '  return (',
    '    <main className="font-sans text-ink">',
    '      <PageJsonLd route={""} />',
    '      {/* @studio:body:start */}',
    '      <HvacNav currentPath="/" />',
    '      <HvacHero />',
    '      <HvacFooter />',
    '      {/* @studio:body:end */}',
    '    </main>',
    '  );',
    '}',
  ].join('\n');
  const parsed = parseExportedPage(page);
  assert.ok(parsed, 'read-back returned null');
  assert.ok(!JSON.stringify(parsed).includes('PageJsonLd'), 'PageJsonLd was read back as a section');
  assert.ok(JSON.stringify(parsed).includes('HvacHero'), 'the body sections were lost');
});

test('both SEO components take home metadata from pageMetadata, so one rule sets every title', () => {
  for (const f of ['SeoDefault.tsx', 'SeoLocalBusiness.tsx']) {
    const s = read(join(CONSOLE, 'src/components/catalog/seo', f));
    assert.match(s, /return pageMetadata\(''\);/, f);
  }
});

test('the template sitemap lists every page from seo-pages.ts, and the export rewrites it each time', () => {
  const sitemap = read(join(OPS, 'template/src/app/sitemap.ts'));
  assert.match(sitemap, /Object\.values\(PAGE_SEO\)\.map\(\(p\) => p\.canonical\)/);
  assert.match(exportSrc(), /copyFileSync\(resolve\(repoRoot, 'template', 'src', 'app', 'sitemap\.ts'\)/);
});

test('the template business node never carries reviews, ratings, FAQs or services', () => {
  const sd = read(join(OPS, 'template/src/lib/structuredData.ts'));
  for (const t of ['Review', 'AggregateRating', 'FAQPage', "'Service'"]) {
    assert.ok(!sd.includes(`'@type': ${t.startsWith("'") ? t : `'${t}'`}`), `structuredData.ts still emits ${t}`);
  }
  assert.match(sd, /if \(BUSINESS_JSONLD\) return/);
});
