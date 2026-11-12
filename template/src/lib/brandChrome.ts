/**
 * The brand box and the copyright line, as the catalog's navs and footers read them.
 *
 * KEEP IN STEP: this file is byte-identical in console/src/lib and template/src/lib, because the
 * catalog components import it in the Studio preview AND in every client repo
 * (console/test/brand-chrome.test.mjs). Client repos have no @jdd/schema dependency, so it reads
 * content structurally and imports nothing.
 *
 * Both fix what Xander's front-to-back test found (E2E-ONBOARDING-TEST-2026-11-10):
 * - F-D2: the intake logo reached `images.footer.logoImage` and was rendered nowhere. Every nav and
 *   footer drew a gradient box beside the name. The logo now fills that box (LogoTile.tsx).
 * - F-D4: the footer read "© 2026 Your HVAC Company LLC". The intake leaves `footer.legal` empty and
 *   the Studio merges the vertical preset under the client's content, so the preset's sample line
 *   filled it. The line is now built from the client's own legal name, and `footer.legal` is not
 *   read: no step of intake or copy generation writes it, so the only value it ever held was a sample.
 */

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** The client's logo (the intake's `branding.logo`, the Brand drawer's Logo tile), or ''. */
export function logoUrl(content: unknown): string {
  return str(obj(obj(obj(content).images).footer).logoImage);
}

/** The name the copyright line carries, with its edit path: the legal name, else the business name. */
export function legalName(content: unknown): { text: string; path: string } {
  const brand = obj(obj(content).brand);
  const long = str(brand.long);
  return long ? { text: long, path: 'brand.long' } : { text: str(brand.name), path: 'brand.name' };
}

/** "© 2026 Tracewell Heating & Air LLC. All rights reserved." The year is the year the site is built. */
export function copyrightLine(content: unknown, year: number = new Date().getFullYear()): string {
  return `© ${year} ${legalName(content).text}. All rights reserved.`;
}
