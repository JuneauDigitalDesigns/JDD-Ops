// CTA routing (PLAN D7, EXEC T5.5 / R5): every call to action that is NOT a phone number routes
// to /contact. Phone CTAs are tel: links. No conversion-area anchor is left without a
// destination at all — a button-styled <a> with no href is a dead link a client would never see
// fail, because it renders fine and does nothing on click.
//
// Roofing (Phase 5) and Plumbing (Phase 8) so far. The allowlist for a non-/contact conversion
// CTA (detailing's "See packages -> /services", D16) is added when detailing lands (EXEC Phase 9)
// — not pre-emptively here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(ROOT, 'src/components/catalog');

const VERTICAL_PREFIXES = ['Roofing', 'Plumbing'];

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

test('every <a> in the Roofing*/Plumbing* catalog has an href (no dead CTA links)', () => {
  const bad = [];
  for (const file of verticalFiles()) {
    const src = readFileSync(file, 'utf8');
    for (const a of anchors(src)) {
      if (a.href === null && !a.isExpression) bad.push(`${path.basename(file)}: <a${a.tag}>`);
    }
  }
  assert.deepEqual(bad, []);
});

test('every literal non-phone, non-mailto Roofing*/Plumbing* CTA href is /contact', () => {
  const bad = [];
  for (const file of verticalFiles()) {
    const src = readFileSync(file, 'utf8');
    for (const a of anchors(src)) {
      if (a.href === null) continue; // dynamic/expression hrefs (data-driven nav/footer links)
      if (a.href.startsWith('tel:') || a.href.startsWith('mailto:')) continue;
      if (ALLOWED_LITERAL_NON_CONVERSION.has(a.href)) continue;
      if (a.href !== '/contact') bad.push(`${path.basename(file)}: href="${a.href}"`);
    }
  }
  assert.deepEqual(bad, []);
});

test('each vertical\'s Hero and Nav carry at least one phone link', () => {
  // The phone CTA is the one thing that must NOT route to /contact — confirms the previous
  // test's allowlist isn't hiding a missed tel: link by accident.
  for (const name of ['hero/RoofingHero.tsx', 'nav/RoofingNav.tsx', 'hero/PlumbingHero.tsx', 'nav/PlumbingNav.tsx']) {
    const src = readFileSync(path.join(CATALOG_DIR, name), 'utf8');
    assert.ok(/href=\{?[`"']?tel:/.test(src) || /brand\.phoneHref/.test(src), `${name} has no phone link`);
  }
});
