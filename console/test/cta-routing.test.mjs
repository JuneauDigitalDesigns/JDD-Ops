// CTA routing (PLAN D7, EXEC T5.5 / R5): every call to action that is NOT a phone number routes
// to /contact. Phone CTAs are tel: links. No conversion-area anchor is left without a
// destination at all — a button-styled <a> with no href is a dead link a client would never see
// fail, because it renders fine and does nothing on click.
//
// Roofing (Phase 5), Plumbing (Phase 8) and Car Detailing (Phase 9, last vertical). Detailing's
// DetailHero carries the one documented exception to the universal CTA rule: "See packages ->
// /services" (D16) — a browse action, not a conversion, so it is allowlisted by exact file +
// href rather than widening /contact's replacement for every vertical.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(ROOT, 'src/components/catalog');

const VERTICAL_PREFIXES = ['Roofing', 'Plumbing', 'Detail'];

/** The one documented non-/contact conversion-area CTA (PLAN D16): DetailHero's "See packages"
 *  browse action. Scoped to this exact file + href so a stray /services elsewhere still fails. */
const D16_EXCEPTION = { file: 'DetailHero.tsx', href: '/services' };

/** Every <Prefix>*.tsx file across all catalog categories, for every prefix in VERTICAL_PREFIXES. */
function verticalFiles() {
  const out = [];
  for (const cat of readdirSync(CATALOG_DIR, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    const dir = path.join(CATALOG_DIR, cat.name);
    for (const f of readdirSync(dir)) {
      if (VERTICAL_PREFIXES.some((p) => f.startsWith(p)) && f.endsWith('.tsx')) out.push(path.join(dir, f));
    }
  }
  return out;
}

/** Every <a ...> opening tag in a source file, with its href attribute value (or null if the
 *  <a> has no href at all) and whether the href is a literal string vs a JS expression. */
function anchors(src) {
  const out = [];
  for (const m of src.matchAll(/<a\b([^>]*)>/g)) {
    const tag = m[1];
    const lit = /href="([^"]*)"/.exec(tag);
    const expr = /href=\{/.test(tag);
    out.push({ tag, href: lit ? lit[1] : null, isExpression: expr && !lit });
  }
  return out;
}

const ALLOWED_LITERAL_NON_CONVERSION = new Set(['/']); // logo links, etc.

/** A per-service page's own header and body (Xander 2026-11-10, service-page-spec.md) carry
 *  navigation, not sales buttons: the breadcrumb's "Services" (it must match the BreadcrumbList
 *  structured data), the "Pricing"/"Questions" jump links, and "Ask for a quote", which jumps to
 *  the page's one form in its final CTA (#cta). Scoped to those files and those hrefs only. */
const SERVICE_PAGE_FILE = /^(Roofing|Plumbing|Detail)Service(Header|Detail)\.tsx$/;
const SERVICE_PAGE_NAV = new Set(['/services', '#pricing', '#questions', '#cta']);
const isServicePageNav = (base, href) => SERVICE_PAGE_FILE.test(base) && SERVICE_PAGE_NAV.has(href);

test('every <a> in the Roofing*/Plumbing*/Detail* catalog has an href (no dead CTA links)', () => {
  const bad = [];
  for (const file of verticalFiles()) {
    const src = readFileSync(file, 'utf8');
    for (const a of anchors(src)) {
      if (a.href === null && !a.isExpression) bad.push(`${path.basename(file)}: <a${a.tag}>`);
    }
  }
  assert.deepEqual(bad, []);
});

test('every literal non-phone, non-mailto Roofing*/Plumbing*/Detail* CTA href is /contact (D16 exception allowlisted)', () => {
  const bad = [];
  for (const file of verticalFiles()) {
    const src = readFileSync(file, 'utf8');
    const base = path.basename(file);
    for (const a of anchors(src)) {
      if (a.href === null) continue; // dynamic/expression hrefs (data-driven nav/footer links)
      if (a.href.startsWith('tel:') || a.href.startsWith('mailto:')) continue;
      if (ALLOWED_LITERAL_NON_CONVERSION.has(a.href)) continue;
      if (base === D16_EXCEPTION.file && a.href === D16_EXCEPTION.href) continue;
      if (isServicePageNav(base, a.href)) continue;
      if (a.href !== '/contact') bad.push(`${base}: href="${a.href}"`);
    }
  }
  assert.deepEqual(bad, []);
});

test('DetailHero carries the D16 "See packages" -> /services exception, and nowhere else does', () => {
  // Pins the allowlist to exactly one file + href, so a future vertical can't silently piggyback
  // on this exception by reusing the same literal href.
  for (const file of verticalFiles()) {
    const src = readFileSync(file, 'utf8');
    const base = path.basename(file);
    // A service page's breadcrumb links to /services as navigation (see SERVICE_PAGE_NAV), not as
    // a CTA; D16 is about a sales-area button, so those files are out of its scope.
    if (SERVICE_PAGE_FILE.test(base)) continue;
    const hasServicesHref = anchors(src).some((a) => a.href === '/services');
    if (base === D16_EXCEPTION.file) {
      assert.ok(hasServicesHref, `${base} should carry the D16 /services exception but does not`);
    } else {
      assert.ok(!hasServicesHref, `${base} has a literal /services href — only ${D16_EXCEPTION.file} is allowlisted`);
    }
  }
});

test('each vertical\'s Hero and Nav carry at least one phone link', () => {
  // The phone CTA is the one thing that must NOT route to /contact — confirms the previous
  // test's allowlist isn't hiding a missed tel: link by accident.
  for (const name of ['hero/RoofingHero.tsx', 'nav/RoofingNav.tsx', 'hero/PlumbingHero.tsx', 'nav/PlumbingNav.tsx', 'hero/DetailHero.tsx', 'nav/DetailNav.tsx']) {
    const src = readFileSync(path.join(CATALOG_DIR, name), 'utf8');
    assert.ok(/href=\{?[`"']?tel:/.test(src) || /brand\.phoneHref/.test(src), `${name} has no phone link`);
  }
});
