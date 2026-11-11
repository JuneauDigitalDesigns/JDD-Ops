// The copy run writes the Services, About and Contact page headers and their SEO, and a section it
// does not write is reported as not written, never left looking done.
//
// The bug (Tracewell Heating & Air, 2026-11-11, finding 5 of the front-to-back onboarding test).
// The run box lists "Page headers" under "Other pages", and the brief had `subpages` ticked, so the
// operator believed the per-page copy was generated. It never was: Generate posted
// {vertical, base, imported, edits, brief, sections, model} with no page list, and
// /api/build/generate-copy drops `subpages` when it gets none, silently. The section's status
// stayed blank. The Launch dialog's SEO check then found:
//   "Description of /services is 32 characters (aim for 140 to 165)", the same for /about and
//   /contact, and "Same description on /services, /about, /contact"
// and the page headers kept their placeholder text.
//
// No model is called: the request body and the compiled prompt are read, and applyGeneratedCopy is
// driven with a hand-made reply shaped like the model's (copy-schema.ts `subpages`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BUILT_IN_VERTICALS } from '@jdd/schema';
import { deepMerge, applyEdits } from '@jdd/ui/merge';
import { presetFor } from '../src/lib/verticals.ts';
import { ALL_SECTIONS } from '../src/lib/copy-schema.ts';
import { resolveBrief } from '../src/lib/copy-brief/resolve.ts';
import { compileBriefPrompt } from '../src/lib/copy-brief/compile-brief.ts';
import { chunkSections } from '../src/lib/copy-brief/chunking.ts';
import { editsFrom } from '../src/lib/copy-brief/grounded.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';
import {
  copyPages, copyRequestBody, planRunSections, missingSubpageRoutes, unreportedSections, SKIP_REASONS,
} from '../src/lib/copy-brief/run-sections.ts';
import { SWITCHABLE } from '../src/lib/run-steps.ts';
import { rewrittenPageKeys } from '../src/lib/copy-review-groups.ts';
import { buildPageSeo } from '../src/lib/pageSeo.ts';
import { scoreSite } from '../src/lib/scorePage.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

const draft = JSON.parse(readFileSync(new URL('./fixtures/copy-brief/tracewell-draft.json', import.meta.url), 'utf8'));
const hvac = BUILT_IN_VERTICALS.find((v) => v.id === 'hvac');
const preset = presetFor('hvac');
const effectiveOf = (generated) => applyEdits(deepMerge(deepMerge(preset, draft.imported), generated ?? {}), draft.edits ?? {});

// Tracewell's composition as measured (clients/tracewell-heating-air/.draft.json siteComposition):
// four pages plus one service page. BuildWizard's intakePages is every page but Home.
const COMPOSITION = [
  { route: '', pageType: 'home', label: 'Home', sections: [] },
  { route: 'services', pageType: 'services', label: 'Services', sections: [] },
  { route: 'about', pageType: 'about', label: 'About', sections: [] },
  { route: 'contact', pageType: 'contact', label: 'Contact', sections: [] },
  { route: 'services/ac-installation-service', pageType: 'service', label: 'AC Installation & Service', sections: [] },
];
const intakePages = COMPOSITION.filter((p) => p.route !== '').map((p) => ({ route: p.route, label: p.label, pageType: p.pageType }));

const ticked = ALL_SECTIONS.filter((s) => s !== 'brand');
const bodyFor = (sections = ticked) => copyRequestBody({
  vertical: 'hvac', base: effectiveOf(draft.generated), imported: draft.imported, edits: draft.edits ?? {},
  brief: draft.brief, sections, model: 'claude-sonnet-4-6', pages: intakePages,
});

/** The route's own steps on a posted body, up to the prompt for the chunk that carries `subpages`. */
function routePlan(body) {
  const subpages = Array.isArray(body.subpages) ? body.subpages : [];
  const plan = planRunSections({ requested: body.sections, all: ALL_SECTIONS, subpages, hasServicePages: true });
  const ctx = {
    vertical: hvac, effective: body.base, imported: body.imported, preset, edits: editsFrom(body.edits),
    brief: body.brief, tickedSections: plan.sections, subpages,
  };
  const blocks = resolveBrief(ctx);
  const chunk = chunkSections(plan.sections).find((c) => c.includes('subpages'));
  return { ...plan, prompt: chunk ? compileBriefPrompt(ctx, blocks, chunk) : null };
}

// ── The request ───────────────────────────────────────────────────────────────────────────

test('Generate posts the Services, About and Contact pages as `subpages`', () => {
  const body = bodyFor();
  assert.deepEqual(body.subpages, [
    { route: 'services', pageType: 'services', label: 'Services' },
    { route: 'about', pageType: 'about', label: 'About' },
    { route: 'contact', pageType: 'contact', label: 'Contact' },
  ], 'the service page is the servicePages section, and its header renders the service');
  assert.ok(body.sections.includes('subpages'));
});

test('both fetches in the run box post that body, not a hand-built one without the pages', () => {
  const src = read('src/components/wizard/prompt/RunControls.tsx');
  const bodies = [...src.matchAll(/body: JSON\.stringify\(([^\n]+)\),?\n/g)].map((m) => m[1]);
  assert.equal(bodies.length, 2, 'the estimate and Generate');
  for (const b of bodies) assert.match(b, /^copyRequestBody\(\{[^}]*\bpages\b[^}]*\}\)$/, b);
  // The page list reaches the box from the composition, through the Prompt step.
  assert.match(read('src/components/wizard/brief/IntakeShell.tsx'), /<PromptStage[\s\S]*?pages=\{pages\}[\s\S]*?\/>/);
  assert.match(read('src/components/wizard/prompt/PromptStage.tsx'), /<RunControls[\s\S]*?pages=\{pages\}[\s\S]*?\/>/);
});

test('the route keeps `subpages` and compiles the page-header instruction for those three pages', () => {
  const { sections, skipped, prompt } = routePlan(bodyFor());
  assert.ok(sections.includes('subpages'), 'the route ran it');
  assert.deepEqual(skipped, []);
  assert.ok(prompt, 'a chunk carries subpages');
  assert.match(prompt.user, /- subpages: exactly one item per route \(services, about, contact\)/);
  assert.match(prompt.user, /Dedicated pages: Services \(\/services\), About \(\/about\), Contact \(\/contact\)/);
  // The bug: the same run, posted the way the run box used to post it.
  const { subpages: _dropped, ...before } = bodyFor();
  const old = routePlan(before);
  assert.ok(!old.sections.includes('subpages'), 'with no page list the route drops it');
  assert.equal(old.prompt, null);
});

test('the page-header chunk sends no preset sample text as a fact or a reference', () => {
  const { prompt } = routePlan(bodyFor());
  for (const sample of [preset.announcement, preset.hero.headline, preset.hero.sub, preset.brand.tagline, preset.brand.address]) {
    if (typeof sample === 'string' && sample.trim()) assert.ok(!prompt.user.includes(sample), `preset text in the brief: ${sample}`);
  }
});

test('the Prompt step shows the same page list the run sends', () => {
  assert.match(read('src/components/wizard/prompt/PromptStage.tsx'), /subpages: copyPages\(pages\)/);
  assert.match(read('src/components/wizard/IntakeStep.tsx'), /resolveBrief\(\{[^\n]*subpages: copyPages\(pages\) \}\)/);
});

test('switching "Page headers" off keeps it off', () => {
  const { sections, skipped, prompt } = routePlan(bodyFor(ticked.filter((s) => s !== 'subpages')));
  assert.ok(!sections.includes('subpages'));
  assert.deepEqual(skipped, [], 'not asked for, so not reported');
  assert.equal(prompt, null);
});

// ── The output ────────────────────────────────────────────────────────────────────────────

/** Shaped like the model's `subpages` reply (copy-schema.ts), written from Tracewell's facts. */
const REPLY = {
  subpages: {
    items: [
      {
        route: 'services', eyebrow: 'What we do', title: 'Heating and cooling, done properly',
        sub: 'AC installation and service, furnace repair and replacement, and attic fan checks.',
        seoTitle: 'HVAC Services in Winter Park | Tracewell Heating & Air',
        seoDescription: 'AC installation and service, furnace repair and replacement, and attic fan checks for homes in Winter Park, Maitland and Oviedo. Call Tracewell to book a visit.',
      },
      {
        route: '/about/', eyebrow: 'About us', title: 'A Winter Park heating and air company',
        sub: 'Tracewell looks after homes across Winter Park, Maitland and Oviedo.',
        seoTitle: 'About Tracewell Heating & Air | HVAC in Winter Park',
        seoDescription: 'Tracewell Heating & Air installs and services AC systems and repairs furnaces for homeowners in Winter Park, Maitland and Oviedo. Meet the team behind the work.',
      },
      {
        route: 'contact', eyebrow: 'Contact', title: 'Book a visit',
        sub: 'Call or send a message and we will get back to you.', ctaLabel: 'Call (407) 555-0177', ctaHref: 'tel:4075550177',
        seoTitle: 'Contact Tracewell Heating & Air | Winter Park HVAC',
        seoDescription: 'Contact Tracewell Heating & Air in Winter Park to book AC installation, AC service, furnace repair or an attic fan check. Call (407) 555-0177 or send a message.',
      },
      {
        route: 'reviews', eyebrow: 'x', title: 'A page this site does not have', sub: 'x', seoTitle: 'x', seoDescription: 'x',
      },
    ],
  },
};

test('the reply lands in subpages.{route}.header and per-page SEO, and the SEO check reads it', () => {
  const routes = bodyFor().subpages.map((p) => p.route);
  const before = effectiveOf(draft.generated);
  const overlay = applyGeneratedCopy(before, REPLY, new Set(['brand', 'subpages']), { subpageRoutes: routes });
  assert.deepEqual(Object.keys(overlay.subpages).sort(), ['about', 'contact', 'services'], '"/about/" is about; reviews was not asked for');
  assert.equal(overlay.subpages.about.header.title, 'A Winter Park heating and air company');
  assert.deepEqual(overlay.subpages.contact.header.cta, { label: 'Call (407) 555-0177', href: 'tel:4075550177' });
  assert.equal(overlay.subpages.services.seo.title, 'HVAC Services in Winter Park | Tracewell Heating & Air');

  // BuildWizard's applyGenerated: the overlay merges over the previous one, key by key.
  const after = effectiveOf({ ...draft.generated, ...overlay });
  const seoBefore = buildPageSeo(before, COMPOSITION, 'hvac');
  const seoAfter = buildPageSeo(after, COMPOSITION, 'hvac');
  for (const r of routes) {
    assert.equal(seoAfter[r].description, REPLY.subpages.items.find((it) => it.route.replace(/\//g, '') === r).seoDescription);
    assert.notEqual(seoAfter[r].description, seoBefore[r].description, `/${r} was described by the fallback`);
  }
  const findings = (c, s) => scoreSite(c, COMPOSITION, s, { preset }).soft;
  assert.ok(findings(before, seoBefore).some((f) => f.startsWith('Same description on /services, /about, /contact')), 'the measured finding');
  const now = findings(after, seoAfter);
  for (const r of routes) assert.ok(!now.some((f) => f.startsWith(`Description of /${r} `)), now.join('\n'));
  assert.ok(!now.some((f) => f.startsWith('Same description on')), now.join('\n'));
});

test('each page the run rewrote waits for review on its own page', () => {
  const before = effectiveOf(draft.generated);
  const overlay = applyGeneratedCopy(before, REPLY, new Set(['brand', 'subpages']), { subpageRoutes: ['services', 'about', 'contact'] });
  assert.deepEqual(rewrittenPageKeys(draft.generated, overlay).sort(), ['about:subpages', 'contact:subpages', 'services:subpages']);
  // A second run that rewrites only About leaves the others' verdicts alone.
  const prev = { ...draft.generated, ...overlay };
  const again = applyGeneratedCopy(effectiveOf(prev), { subpages: { items: [{ ...REPLY.subpages.items[1], title: 'New title' }] } },
    new Set(['brand', 'subpages']), { subpageRoutes: ['services', 'about', 'contact'] });
  assert.deepEqual(rewrittenPageKeys(prev, again), ['about:subpages']);
});

// ── No silent drop ────────────────────────────────────────────────────────────────────────

test('a requested section the route cannot write is reported with its reason', () => {
  const plan = planRunSections({ requested: ['hero', 'subpages', 'servicePages'], all: ALL_SECTIONS, subpages: [], hasServicePages: false });
  assert.deepEqual(plan.sections, ['hero']);
  assert.deepEqual(plan.skipped, [
    { section: 'subpages', reason: SKIP_REASONS.noPages },
    { section: 'servicePages', reason: SKIP_REASONS.noServicePages },
  ]);
  // The route streams each one as `skipped`, which the box shows as not written, never done.
  const route = read('src/app/api/build/generate-copy/route.ts');
  assert.match(route, /const \{ sections, skipped \} = planRunSections\(/);
  assert.match(route, /for \(const s of skipped\) send\(\{ type: 'section', section: s\.section, status: 'skipped', error: s\.reason \}\)/);
  const box = read('src/components/wizard/prompt/RunControls.tsx');
  assert.match(box, /if \(status === 'skipped'\) return <Warning/);
  assert.match(box, /msg\.status === 'skipped'/);
});

test('a page the model leaves out makes `subpages` not done', () => {
  const pages = copyPages(intakePages);
  assert.deepEqual(missingSubpageRoutes(pages, REPLY.subpages), []);
  assert.deepEqual(missingSubpageRoutes(pages, { items: REPLY.subpages.items.slice(0, 1) }), ['about', 'contact']);
  assert.equal(SKIP_REASONS.missingRoutes(['about', 'contact']), 'Not written for /about, /contact: missing from the reply.');
  assert.match(read('src/app/api/build/generate-copy/route.ts'), /missing\.length\) \{\n\s+send\(\{ type: 'section', section: s, status: 'skipped'/);
});

test('a switched-on section a finished run never mentioned is marked not written', () => {
  const statuses = { hero: 'done', faq: 'failed', subpages: 'idle' };
  assert.deepEqual(unreportedSections(['hero', 'faq', 'subpages', 'about:subpages'], statuses, SWITCHABLE), ['subpages']);
});
