// Intake photos reach the Studio (Xander 2026-11-12: "When I come into the intake wizard on the
// console and I fill in the intake and provide photos, those photos are not making it from the
// intake wizard into the studio. I'm still seeing placeholder images.").
//
// What happened on clients/_e2e_test_growth (read-only evidence, 2026-11-12):
// - Four photos were staged in console/.uploads (two at 21:35, the same two again at 21:39). The
//   intake stores them as `upload://<file>` refs in the draft's edits (work.projects and the
//   service's image), and nothing could show such a ref, so the first two looked lost.
// - The client has an exported repo, and an exported client opened from the repo with `edits: {}`
//   on every load, never reading .draft.json. A successful export deletes that draft, so one that
//   exists is the only copy of the work since. The 22:13 export failed (the repo's site.ts is still
//   the template's), and the next load opened the intake's site.ts, picsum placeholders and all.
// - The draft that load saved (savedAt 2026-11-12T12:32Z) holds the picsum images in `imported`
//   and only the template's palette and type in `edits`: the photo edits are gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startingBundle } from '../src/lib/wizardBundle.ts';
import { previewSrc, stagedFileName, withStagedPreviews, isStagedFileName } from '../src/lib/stagedUploads.ts';
import { effectiveContent } from '../src/lib/effectiveContent.ts';

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(CONSOLE, p), 'utf8').replace(/\r\n/g, '\n');

// The real staged files and draft values from clients/_e2e_test_growth.
const STAGED = ['d68f8deb-0223-40ee-b47e-296ae9f0f0b5.jpg', 'a411bab6-c02b-423d-9375-a689ea2241b4.jpg'];
const PICSUM = {
  portrait: 'https://picsum.photos/seed/hvac-hero/1600/900',
  slides: [
    { url: 'https://picsum.photos/seed/hvac-hero-1/1600/900', alt: 'HVAC technician on the job' },
    { url: 'https://picsum.photos/seed/hvac-hero-2/1600/900', alt: 'AC installation in progress' },
  ],
};
const PALETTE = { accent: '#E0602C', accent2: '#1E3A5F', accentFg: '#FFFFFF', bg: '#FFFFFF', bgSoft: '#F4F6F8', ink: '#13293F', inkSoft: '#4C5E74', rule: '#E2E8F0' };

/** The draft as the intake left it, before the load that dropped it: the photos are edits. */
function draftWithPhotos(savedAt) {
  const jobs = STAGED.map((f, k) => ({ t: 'AC Installation & Service', loc: '', yr: null, scope: 'AC Installation & Service', size: '', caption: `AC job ${k + 1}`, image: { url: `upload://${f}`, alt: `AC job ${k + 1}` } }));
  return {
    savedAt,
    vertical: 'hvac',
    imported: { images: { hero: PICSUM, about: { feature: 'https://picsum.photos/seed/hvac-about/900/600' } }, services: { items: [{ t: 'AC Installation & Service' }] }, work: { projects: [], hidden: true } },
    generated: null,
    edits: { 'brand.palette': PALETTE, 'work.projects': jobs, 'services.items.0.image': jobs[0].image },
  };
}

// The 22:13 export, had it failed at `npm run build`: it writes the composition manifest while wiring
// the pages, before the build, so the repo's write time moves past the draft. #89's time rule alone
// then opens the half-written repo and drops the only copy of the photos.
const BUILD_FAILED_AT = Date.parse('2026-11-11T22:20:00Z');

test('an exported client with a server draft opens the draft, even after an export that failed at the build', () => {
  const server = draftWithPhotos(Date.parse('2026-11-11T21:40:00Z'));
  const staleLocal = { ...draftWithPhotos(Date.parse('2026-11-10T09:00:00Z')), edits: {} }; // a browser copy from before
  const open = (saved, srv, exportedAt) => startingBundle({ saved, server: srv, exported: true, exportedAt });
  assert.deepEqual(open(staleLocal, server, BUILD_FAILED_AT), { from: 'draft', bundle: server }, 'a draft that exists is unshipped work: a successful export deletes it');
  assert.deepEqual(open(null, server, BUILD_FAILED_AT), { from: 'draft', bundle: server });
  const newerLocal = draftWithPhotos(Date.parse('2026-11-11T21:41:00Z'));
  assert.equal(open(newerLocal, server, BUILD_FAILED_AT).bundle, newerLocal, 'a newer copy in this browser wins, as for any client');
  // No server draft: the last export succeeded, so only a browser copy saved after it may open (#89).
  assert.deepEqual(open(staleLocal, null, BUILD_FAILED_AT), { from: 'disk', bundle: null }, 'a browser copy alone may predate the export');
  assert.equal(open(draftWithPhotos(BUILD_FAILED_AT + 60_000), null, BUILD_FAILED_AT).from, 'draft');
  assert.deepEqual(startingBundle({ saved: staleLocal, server: null, exported: false, exportedAt: null }), { from: 'draft', bundle: staleLocal }, 'never exported: unchanged');
});

test('the Studio decides with startingBundle, reading the server draft, before opening a repo', () => {
  const src = read('src/app/c/[slug]/build/BuildWizard.tsx');
  const hydration = src.slice(src.indexOf('const saved = readBundle(slug);'), src.indexOf('applyBundle(start.bundle ?? freshBundle(seed));'));
  assert.match(hydration, /startingBundle\(\{\s*saved,\s*server: draftBundle/, 'the server draft is read');
  assert.match(hydration, /if \(start\.from === 'disk'\) \{/, 'the repo (edits: {}) opens only when the rule says so');
  assert.ok(hydration.indexOf('startingBundle(') < hydration.indexOf('edits: {}'));
});

test('the restored draft\'s photos survive every strip pass into the Studio\'s content', () => {
  const d = draftWithPhotos(1);
  const c = effectiveContent('hvac', d.imported, d.generated, d.edits);
  assert.deepEqual(c.work.projects.map((p) => p.image.url), STAGED.map((f) => `upload://${f}`), 'real photo jobs are not samples');
  assert.equal(c.services.items[0].image.url, `upload://${STAGED[0]}`);
});

test('a staged photo can be shown before export, in the intake and in the Studio preview', () => {
  assert.equal(stagedFileName(`upload://${STAGED[0]}`), STAGED[0]);
  assert.equal(previewSrc(`upload://${STAGED[0]}`), `/api/build/upload/${STAGED[0]}`);
  assert.equal(previewSrc('https://picsum.photos/x'), 'https://picsum.photos/x');
  assert.equal(previewSrc('/img/abc'), '/img/abc');
  assert.equal(previewSrc(''), null);
  // Only a staged file name: no traversal, no other files.
  for (const bad of ['upload://../.env', 'upload://x.jpg', `upload://${STAGED[0]}/../../a`, 'upload://' + STAGED[0].replace('.jpg', '.exe')]) {
    assert.equal(stagedFileName(bad), null, bad);
  }
  assert.equal(isStagedFileName('..%2F.env'), false);
  const c = withStagedPreviews(effectiveContent('hvac', draftWithPhotos(1).imported, null, draftWithPhotos(1).edits));
  assert.equal(c.work.projects[1].image.url, `/api/build/upload/${STAGED[1]}`);
  assert.equal(c.services.items[0].image.url, `/api/build/upload/${STAGED[0]}`);
  assert.equal(c.images.hero.portrait, PICSUM.portrait, 'everything else untouched');
});

test('the preview maps staged refs, the saved draft keeps them, and the thumbnails show them', () => {
  const wizard = read('src/app/c/[slug]/build/BuildWizard.tsx');
  assert.match(wizard, /withStagedPreviews\(/, 'the Studio preview shows staged photos');
  assert.match(read('src/app/c/[slug]/build/PageStudio.tsx'), /withStagedPreviews\(/, 'and so do the sections PageStudio draws itself');
  assert.doesNotMatch(wizard, /const effective = useMemo\([^;]*withStagedPreviews/s, 'effective (saved, exported) keeps upload:// refs');
  for (const f of ['src/components/wizard/intake/ServicesStep.tsx', 'src/components/fields/index.tsx', 'src/app/c/[slug]/build/brand/ImageTile.tsx']) {
    assert.match(read(f), /previewSrc\(/, `${f}: a staged photo shows as a thumbnail`);
  }
  assert.match(read('src/app/api/build/upload/[file]/route.ts'), /isStagedFileName\(file\)/);
});
