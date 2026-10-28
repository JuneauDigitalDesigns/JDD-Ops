// Catalog invariants — the regressions this rebuild actually hit, encoded so they cannot
// come back silently.
//
// Every check below corresponds to a defect that shipped, passed typecheck, passed
// `next build`, and in most cases passed Lighthouse too. They were caught by reading a
// screenshot, diffing two files by hand, or swapping a palette. That is not a repeatable
// process, so it is a test suite instead.
//
// Run: npm test   (node's built-in runner — no new dependency)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Straight from @jdd/ui, not through the ../src/lib/skins.ts shim: that file is a bare
// `export * from '@jdd/ui/skins'`, and the tsx loader does not surface named exports through
// a star re-export of a .ts source inside node_modules. Same reason SKINS is imported this way.
import { SKINS, isValidSkin, supportsSkin } from '@jdd/ui/skins';
import { ARCHETYPES, COLLISION_EXEMPT_CATEGORIES } from '../src/lib/archetypes.ts';
import { PAGE_TEMPLATES, defaultCompositionFor } from '../src/app/c/[slug]/build/page-templates.tsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(ROOT, 'src/components/catalog');

/** Every catalog component file, as { name, category, rel, src }. */
function components() {
  const out = [];
  for (const cat of readdirSync(CATALOG_DIR)) {
    const dir = path.join(CATALOG_DIR, cat);
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.tsx')) continue;
      out.push({
        name: f.replace('.tsx', ''),
        category: cat,
        rel: `${cat}/${f}`,
        src: readFileSync(path.join(dir, f), 'utf8'),
      });
    }
  }
  return out;
}

const ALL = components();

// Bespoke whole-site vertical-template components (meta `verticalTemplate: true`, composed by
// VERTICAL_TEMPLATES — see src/components/CATALOG-LEGACY.md). They are pinned to an approved,
// human-designed mockup rather than assembled from the generic catalog, so the anti-slop
// HEURISTICS that exist to keep the generic catalog from reading as AI-made do NOT apply to them:
// archetype variety (decision 23), no-gradients (30b) and no-uniform-three-up (30a). The mockup
// deliberately uses a warm hero wash, a dark-CTA glow and three-up grids. Every UNIVERSAL check
// still applies (img dimensions, chrome anchors, accent-fg/contrast, "use client", lead-form).
const isVerticalTemplate = (c) => /verticalTemplate:\s*true/.test(c.src);

test('catalog is non-empty (guards against a broken glob silently passing everything)', () => {
  assert.ok(ALL.length > 20, `expected >20 components, found ${ALL.length}`);
});

// Decision 28 cut the two ornamental signature effects. parallaxY stays EXPORTED from
// @jdd/ui/motion (removing it would break an already-exported client repo), but no catalog
// component may call it, and no component may hand-roll the cursor-glow it also cut (a pointer
// handler writing --mx/--my CSS vars). Both were a whole component's identity once.
test('no component uses the cut signature effects: parallaxY or cursor glow (decision 28)', () => {
  const offenders = [];
  for (const c of ALL) {
    if (/\bparallaxY\b/.test(c.src)) offenders.push(`${c.rel}: parallaxY`);
    if (/onMouseMove/.test(c.src) && /--m[xy]\b/.test(c.src)) {
      offenders.push(`${c.rel}: cursor glow (--mx/--my from a pointer handler)`);
    }
  }
  assert.deepEqual(offenders, [], `cut signature effects present:\n${offenders.join('\n')}`);
});

// A nav/footer component is site CHROME — it renders on every page. A hardcoded `#section`
// anchor in it (the brand wordmark's `#top`, a CTA's `#cta`) therefore scrolls to nothing on
// every page that doesn't host that section, which on a multi-page site is most of them. That
// shipped on _e2e_test_starter. Chrome link targets must come from the data (footer.cols) or be
// derived from `nav` (NavMinimal/NavEmergencyBar's multiPage branch), never baked into the JSX.
test('no nav/footer component hardcodes a section anchor (would dangle off-page on multi-page)', () => {
  const SECTION_ANCHOR = /href="#(top|cta|services|about|testimonials|faq|work|contact)"/;
  const offenders = [];
  for (const c of ALL) {
    if (c.category !== 'nav' && c.category !== 'footer') continue;
    const m = SECTION_ANCHOR.exec(c.src);
    if (m) offenders.push(`${c.rel}: ${m[0]}`);
  }
  assert.deepEqual(offenders, [], `hardcoded chrome anchors present:\n${offenders.join('\n')}`);
});

// ── The four sources that must agree ─────────────────────────────────────────
// Drift here is what let a starter client pick a variant the exporter would then reject.
test('CATALOG, the studio registry and SKINS agree', () => {
  const exportSrc = readFileSync(path.join(ROOT, 'src/lib/export.ts'), 'utf8');
  const block = /export const CATALOG[^{]*\{([\s\S]*?)\n\};/.exec(exportSrc)[1];
  const catalog = {};
  for (const m of block.matchAll(/^\s*(\w+):\s*\[([^\]]*)\]/gm)) {
    catalog[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }

  const cats = readFileSync(path.join(ROOT, 'src/app/c/[slug]/build/categories.tsx'), 'utf8');
  const registry = new Set([...cats.matchAll(/name: '(\w+)'/g)].map((m) => m[1]));

  // Imported, not regexed: src/lib/skins.ts is a re-export shim since the extraction of
  // @jdd/ui, so scraping it for a SKINS literal finds nothing. Reading the real value also
  // means this assertion cannot drift from the implementation.
  const skinNames = new Set(Object.keys(SKINS));

  for (const [cat, names] of Object.entries(catalog)) {
    for (const n of names) {
      assert.ok(existsSync(path.join(CATALOG_DIR, cat, `${n}.tsx`)), `CATALOG lists ${cat}/${n} but no file exists`);
      if (cat !== 'seo') assert.ok(registry.has(n), `CATALOG has ${n} but the studio registry does not offer it`);
    }
  }
  const inCatalog = (n) => Object.values(catalog).some((v) => v.includes(n));
  for (const n of registry) assert.ok(inCatalog(n), `studio offers ${n} but CATALOG would reject the export`);
  for (const n of skinNames) assert.ok(inCatalog(n), `SKINS lists ${n} but it is not in CATALOG`);

  // Every file on disk must be reachable, or it is dead code the studio can never show.
  for (const c of ALL) {
    assert.ok(inCatalog(c.name), `${c.rel} exists but CATALOG omits it`);
  }
});

// ── Per-component invariants ─────────────────────────────────────────────────

test('no component owns a lead form', () => {
  // Thirteen components each had their own copy. Three defects repeated in all of them,
  // including an `error` status that was set and never rendered — a failed POST showed the
  // visitor nothing and the lead was lost silently. One <LeadForm> owns this now.
  const bad = ALL.filter((c) => /fetch\(['"]\/api\/contact['"]/.test(c.src));
  assert.deepEqual(bad.map((c) => c.rel), [], 'these should use <LeadForm> from @/lib/LeadForm');
});

test('no placeholder-only inputs', () => {
  // A placeholder is not an accessible name: announced inconsistently, and gone on input.
  const bad = ALL.filter((c) => /<input[^>]*placeholder=/.test(c.src));
  assert.deepEqual(bad.map((c) => c.rel), []);
});

test('every <img> declares width and height', () => {
  // Load-bearing even when CSS sets the rendered size: it is the only intrinsic ratio
  // available before the bytes arrive. Omitting it measured CLS 0.193 on one page.
  const bad = [];
  for (const c of ALL) {
    for (const tag of c.src.match(/<img[\s\S]{0,600}?\/>/g) ?? []) {
      if (!/width=/.test(tag) || !/height=/.test(tag)) bad.push(c.rel);
    }
  }
  assert.deepEqual([...new Set(bad)], []);
});

test('every nav component that consumes nav renders the page links (plan 9e)', () => {
  // A nav variant whose meta.consumes includes 'nav' MUST actually render content.nav (nav.map),
  // or a multi-page client using that variant gets a navbar with no links to its new pages.
  // NavEmergencyBar shipped exactly this: consumes 'nav' but rendered only brand + a CTA. Pinned
  // so a future nav variant cannot reintroduce it. See PLAN-template-fidelity-v2.md section 9e.
  const bad = [];
  for (const c of ALL.filter((c) => c.category === 'nav')) {
    if (/consumes:\s*\[[^\]]*['"]nav['"]/.test(c.src) && !/nav\.map\(/.test(c.src)) bad.push(c.rel);
  }
  assert.deepEqual(bad, []);
});

test('no wide-tracked uppercase eyebrows', () => {
  // Cut by SPEC §3. The heading names the section and a plain sentence supports it.
  //
  // Exempts verticalTemplate components, same principle as the isVerticalTemplate block above:
  // they are pinned to an approved mockup, not assembled from the generic catalog, so an
  // anti-slop heuristic doesn't apply to a value the mockup itself specifies. This check never
  // consulted isVerticalTemplate before 2026-10-28 — not a deliberate carve-out, just that no
  // Hvac* component happened to use exactly 0.2em (they use 0.17/0.12/0.04/0.01) until roofing's
  // mockup (home-mockups.html #roofing .eyebrow{letter-spacing:.2em}) did.
  const bad = ALL.filter((c) => !isVerticalTemplate(c) && /tracking-\[0\.2/.test(c.src));
  assert.deepEqual(bad.map((c) => c.rel), []);
});

test('no component defaults to a retired skin name', () => {
  // The ids survive for already-exported repos, but nothing should AUTHOR them.
  const bad = ALL.filter((c) => /skin = '(editorial|contrast|quiet)'/.test(c.src));
  assert.deepEqual(bad.map((c) => c.rel), []);
});

test('no opacity applied to text sitting on the accent surface', () => {
  // The subtlest one. --accent-fg is chosen by measured contrast and is therefore guaranteed
  // legible on the accent — and then an opacity multiplier silently discards that guarantee,
  // on some palettes only. It passed on #e08b29 (5.06:1 at 80%) and failed on #E05C2A
  // (3.97:1), which is the accent the hvac preset actually ships.
  const bad = [];
  for (const c of ALL) {
    // Elements that are BOTH on an accent-filled ancestor and carry an opacity utility.
    if (!/bg-accent[^a-zA-Z0-9-]/.test(c.src)) continue;
    for (const m of c.src.matchAll(/className=[^\n]*opacity-\d+[^\n]*/g)) {
      const line = m[0];
      // Exempt from contrast requirements: disabled and hover states (WCAG applies to the
      // resting state), and anything aria-hidden.
      if (/disabled:opacity|hover:opacity|aria-hidden/.test(line)) continue;
      // Icon components are not text. The opening tag is often on an EARLIER line than the
      // className, so look back at the element rather than only at the matched line.
      const element = c.src.slice(Math.max(0, m.index - 220), m.index + line.length);
      const openTag = element.lastIndexOf('<');
      if (openTag !== -1 && /^<[A-Z]/.test(element.slice(openTag))) continue;  // <Star …/>
      if (/\bsize=\{/.test(element)) continue;
      bad.push(`${c.rel}: ${line.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, [], 'get hierarchy from size and weight, not transparency (SPEC §10a)');
});

// ── Phase 4: decision 23's variety rule, and decision 30's four bans ────────────────────────

/** meta.archetype for one component, or null. */
function archetypeOf(src) {
  const m = /archetype:\s*'([a-z-]+)'/.exec(src);
  return m ? m[1] : null;
}

test('every component declares a known archetype and a signature flag', () => {
  // Decision 23. A component without these is invisible to the collision lint and to
  // page-rhythm.test.mjs's motion budget, so a missing field is a silent hole in both.
  for (const c of ALL) {
    // Vertical-template components still declare a signature flag (page-rhythm's motion budget
    // reads it) but carry no archetype — they are never offered alongside sibling variants, so
    // the collision lint has nothing to compare them against.
    if (isVerticalTemplate(c)) {
      assert.match(c.src, /signature:\s*(true|false)/, `${c.rel}: meta has no signature flag`);
      continue;
    }
    const a = archetypeOf(c.src);
    assert.ok(a, `${c.rel}: meta has no archetype`);
    assert.ok(ARCHETYPES.includes(a), `${c.rel}: unknown archetype '${a}'`);
    assert.match(c.src, /signature:\s*(true|false)/, `${c.rel}: meta has no signature flag`);
  }
});

test('no two variants in a category share an archetype', () => {
  // THE variety rule, decision 23, mechanical at last. Gap G6: the rule was prose in
  // DESIGN-LANGUAGE.md and nothing stopped a third variant being a decorated copy of a sibling,
  // which grows the count without growing variety.
  const byCat = new Map();
  for (const c of ALL) {
    if (COLLISION_EXEMPT_CATEGORIES.includes(c.category)) continue;   // seo renders nothing
    if (isVerticalTemplate(c)) continue;                              // pinned to a mockup, no archetype
    const a = archetypeOf(c.src);
    const seen = byCat.get(c.category) ?? new Map();
    assert.ok(!seen.has(a), `${c.category}: ${c.name} and ${seen.get(a)} are both '${a}'. ` +
      `Recompose one into a different structure (see console/DESIGN-LANGUAGE.md), do not decorate it.`);
    seen.set(a, c.name);
    byCat.set(c.category, seen);
  }
});

test('no uniform three-up card row (decision 30a)', () => {
  // Research §6 item 2: "three equal feature cards in a row, fading in on scroll." The tell is
  // THREE EQUAL CARDS, not a 3-column grid over a client's real variable-length list:
  // services/ServicesGrid renders every service the client has, commonly six, and is legitimate.
  // So the ban is three precise clauses rather than a blanket grid-cols-3 regex, which would
  // fail three existing and correct components and need a baseline allowlist.
  const SPANNED = /col-span-|row-span-|grid-flow-dense/;
  const ICON_CARD_CATEGORIES = ['differentiators', 'about', 'trust'];
  const bad = [];
  for (const c of ALL) {
    if (isVerticalTemplate(c)) continue;                     // mockup-pinned; three-up is intentional
    if (!/\bgrid-cols-3\b/.test(c.src)) continue;            // matches sm:/md:/lg: prefixes too
    if (/\.slice\(0,\s*3\)/.test(c.src)) { bad.push(`${c.rel}: grid-cols-3 over a hard-capped three`); continue; }
    if (!/\.map\(/.test(c.src))          { bad.push(`${c.rel}: grid-cols-3 with three literal children`); continue; }
    if (ICON_CARD_CATEGORIES.includes(c.category) && !SPANNED.test(c.src)) {
      bad.push(`${c.rel}: a uniform three-up in '${c.category}', which is where the tell lives`);
    }
  }
  assert.deepEqual(bad, [], 'get presence from span variation or from a different archetype entirely');
});

test('no gradients (decision 30b)', () => {
  // Research §6 items 1 and 3. Two hard-stopped patterns are allowed BY NAME because neither is
  // a feather: the 45-degree hatch (AUTHORING_CONTRACT §3's own mandated image placeholder) and
  // the 1px dot grid. Everything else, including bg-accent-grad, is out.
  const ALLOWED = [/repeating-linear-gradient\(/g, /radial-gradient\(circle at 1px 1px/g];
  const bad = [];
  for (const c of ALL) {
    if (isVerticalTemplate(c)) continue;                     // mockup-pinned; warm wash / CTA glow are intentional
    let src = c.src;
    for (const a of ALLOWED) src = src.replace(a, '');
    for (const m of src.matchAll(/bg-accent-grad|bg-gradient-to-|linear-gradient\(|radial-gradient\(/g)) {
      bad.push(`${c.rel}: ${m[0]}`);
    }
  }
  assert.deepEqual(bad, [], 'flat scrims and flat accent fills; --accent-grad is deprecated (decision 3 keeps it resolving for shipped repos only)');
});

test('icons are solid and weighty (decision 30c)', () => {
  // SPEC §6: "Solid, weighty, literal." Research §4 names "generic line-art service icons" as
  // part of the decorative vocabulary where the cheapness lives, and Phosphor's thin/light/
  // regular weights ARE line art. Measured 2026-10-06: the catalog already uses only bold and
  // fill, so this locks in a property the catalog has rather than asking for a migration.
  const bad = [];
  for (const c of ALL) {
    for (const m of c.src.matchAll(/weight="(\w+)"/g)) {
      if (!['bold', 'fill'].includes(m[1])) bad.push(`${c.rel}: weight="${m[1]}"`);
    }
  }
  assert.deepEqual(bad, []);
});

test('no hard-coded white on an accent surface (decision 10 / the accentFg guarantee)', () => {
  // --accent-fg is chosen by MEASURED contrast against the authored accent. A literal
  // `text-white` discards that guarantee, and it is the exact shipped defect
  // palette-contrast.test.mjs covers from the token side: #ffffff on #e08b29 is 2.66:1.
  // The existing opacity lint above only catches `opacity-N` utilities, so slash-opacity
  // (`text-white/85`) used to slip through both. This closes that.
  const bad = [];
  for (const c of ALL) {
    for (const m of c.src.matchAll(/className=[^\n]*\btext-white\b[^\n]*/g)) {
      bad.push(`${c.rel}: ${m[0].trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, [], 'on-accent text is text-accentFg; on-ink text is text-onInk');
});

test('no page template assigns a skin its component does not support', () => {
  // SHIPPED DEFECT. `home-standard` — the template that seeds defaultCompositionFor(), i.e.
  // the home page of every new client — carried `skin="inverted"` on FinalCtaBanner, which has
  // no entry in SKINS and no `skin` prop at all.
  //
  // Nothing rendered differently, because wirePages gates the attribute on `supportsSkin`. But
  // the export route's `validateEntries` checks skin validity BEFORE wiring, over the flattened
  // component list, and threw `Unknown skin "inverted" for component "FinalCtaBanner"`. The
  // DEFAULT four-page site therefore could not be exported AT ALL — found only by trying to
  // repair a client whose live site had collapsed to a nav bar above a footer.
  //
  // Asserted over every template, not just the default: the same mistake in an optional
  // template breaks the export only for the clients who happened to pick it, which is worse.
  const bad = [];
  for (const t of PAGE_TEMPLATES) {
    for (const s of t.sections) {
      if (!s.skin) continue;
      if (!isValidSkin(s.name, s.skin)) {
        bad.push(`${t.id}: ${s.name} skin="${s.skin}" (supportsSkin=${supportsSkin(s.name)})`);
      }
    }
  }
  assert.deepEqual(bad, [], 'the export route’s validateEntries will refuse these compositions');
});

test('every chrome fallback and default-composition skin is valid too', () => {
  // The same check for the parts of a composition that are not page sections. Chrome is chosen
  // once per site, so an invalid skin there would block every export rather than some.
  const comp = defaultCompositionFor();
  const bad = [];
  for (const [slot, ref] of Object.entries(comp.chrome)) {
    if (ref.skin && !isValidSkin(ref.name, ref.skin)) bad.push(`chrome.${slot}: ${ref.name} skin="${ref.skin}"`);
  }
  assert.deepEqual(bad, []);
});

test('every component importing a client-only package declares "use client"', () => {
  // SHIPPED DEFECT, and the one that made a multi-page export unbuildable.
  //
  // All four pageHeader components lacked the directive while three of them imported
  // `@phosphor-icons/react`, whose module scope calls React.createContext. Pulled into a
  // SERVER component that resolves against the react-server build of React, where
  // createContext does not exist — so `next build` failed collecting page data for every
  // subpage with `(0 , l.createContext) is not a function`.
  //
  // It could only ever surface on a multi-page site, because pageHeader renders exclusively on
  // subpages, and no multi-page export had ever completed. 39 of 45 catalog components already
  // had the directive; this makes the rule the catalog was already following enforceable.
  const CLIENT_ONLY = ['@phosphor-icons/react', 'framer-motion'];
  const bad = [];
  for (const c of ALL) {
    const needs = CLIENT_ONLY.filter((p) => c.src.includes(`from '${p}'`));
    if (needs.length === 0) continue;
    if (!/^\s*(['"])use client\1;/m.test(c.src.split('\n').slice(0, 3).join('\n'))) {
      bad.push(`${c.rel}: imports ${needs.join(', ')} without "use client"`);
    }
  }
  assert.deepEqual(bad, [], 'a server component cannot import a package that calls createContext');
});

test('seo components stay SERVER components', () => {
  // The flip side, and why the rule above is scoped to client-only imports rather than applied
  // blanket. An seo component's whole job is to export `generateMetadata`, which Next may only
  // collect from a server module — a "use client" here would break metadata on every site.
  for (const c of ALL.filter((x) => x.category === 'seo')) {
    assert.doesNotMatch(c.src.split('\n').slice(0, 3).join('\n'), /use client/, `${c.rel} must stay server-side`);
    assert.match(c.src, /export\s+(async\s+)?function\s+generateMetadata|export\s+const\s+generateMetadata/, c.rel);
  }
});
