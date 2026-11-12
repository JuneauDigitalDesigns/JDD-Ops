import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { redirect } from 'next/navigation';
import type { SiteContent } from '@/data/site';
import { getClientCached } from '@/lib/clients';
import { getOnboardingGate } from '@/lib/onboardingGate';
import { loadIntake, withPlan } from '@/lib/intake';
import { clientDir } from '@/lib/paths';
import { readDraft } from '@/lib/draft';
import { readStudioComposition, repoPagePath } from '@/lib/studio-readback';
import { readCompositionManifest, manifestPath } from '@/lib/composition-manifest';
import { loadProvisionedFields } from '@/lib/provisionedFields';
import BuildWizard from './BuildWizard';

/**
 * The Build tool for one client. Two steps now — Intake, then Studio — because picking the
 * client was step 1, and the shell already knows who we're building for.
 *
 * The seed is read here on the server: the same loadIntake() call /api/build/load-client
 * makes, minus the round trip and the loading state the old step 1 had to render. A saved
 * localStorage bundle for this slug still wins inside BuildWizard — this is only the
 * starting point for a client that has never been opened.
 */
export const dynamic = 'force-dynamic';

/**
 * The content the console last exported, read from the repo's src/data/site.ts — but only when
 * the console wrote that file (its provenance marker). onboard.js's own site.ts is not studio
 * content and stays out of this.
 *
 * Reopening an exported client used to rebuild the studio from the INTAKE (clients/{slug}/site.ts)
 * with an empty edit layer, because the export deletes the draft that held the edits. The
 * template's palette and type live in that edit layer, so a reload showed the template's sections
 * in the intake's colours, and a Deploy from there shipped that instead of what was previewed.
 */
async function readExportedContent(repoDir: string): Promise<Record<string, unknown> | null> {
  const file = resolve(repoDir, 'src', 'data', 'site.ts');
  if (!existsSync(file)) return null;
  try {
    const src = readFileSync(file, 'utf8');
    const pf = await loadProvisionedFields();
    return pf.hasConsoleMarker(src) ? pf.extractContentObject(src) : null;
  } catch {
    return null;
  }
}

export default async function BuildPage({ params }: { params: { slug: string } }) {
  // Second layer of the onboarding gate (the tab is dimmed in the layout, but a typed URL
  // or bookmark still lands here). Unlike the API guard this redirects rather than 403s.
  const ctx = await getClientCached(params.slug);
  if (ctx && !(await getOnboardingGate(ctx)).onboarded) redirect(`/c/${params.slug}/manage/overview`);

  const intake = await loadIntake(resolve(clientDir(params.slug), 'site.ts'));
  // withPlan stamps _meta.selectedPlan so buildCategories() picks the right lead-capture
  // components. The cast mirrors what /api/build/load-client's consumer always did: the
  // loader is typed loosely (RawSite) because it parses arbitrary on-disk files.
  const seed = withPlan(intake?.sites?.[0] ?? null, intake?.plan) as SiteContent | null;

  // What the client's site is ACTUALLY made of, read out of their exported repo. This is what
  // lets the studio open a live client showing its real sections instead of a blank page — the
  // composition used to exist only in whichever browser last built it.
  //
  // Two sources, in order of fidelity. The manifest is the whole multi-page composition, written
  // by the exporter itself. The page parser is a lossy fallback for repos exported before the
  // manifest existed: it reads only home's page.tsx and cannot represent a second page, so
  // preferring it would keep collapsing multi-page clients to one page on every reopen.
  const repoDir = resolve(clientDir(params.slug), 'repo');
  const manifest = readCompositionManifest(repoDir);
  const composition = readStudioComposition(params.slug);
  const draftBundle = readDraft(params.slug);
  // The repo itself, independent of whether the console ever exported it. onboard.js
  // provisions a repo the read-backs above can't parse, and that client is still live.
  const hasRepo = existsSync(resolve(repoDir, 'package.json'));
  const exportedRaw = manifest || composition ? await readExportedContent(repoDir) : null;
  // Same plan stamp as the seed, so the Studio offers the same lead-capture components.
  const exportedContent = exportedRaw ? (withPlan(exportedRaw as Parameters<typeof withPlan>[0], intake?.plan) as SiteContent | null) : null;

  // When the repo was last written: the export writes the manifest, onboard.js and older exports
  // write home's page.tsx. A draft saved after this is newer work than the repo (startingBundle).
  const written = [manifestPath(repoDir), repoPagePath(params.slug)].find((p) => existsSync(p));
  const exportedAt = written ? statSync(written).mtimeMs : null;

  return (
    <BuildWizard
      slug={params.slug}
      seed={seed}
      manifest={manifest}
      composition={composition}
      draftBundle={draftBundle}
      hasRepo={hasRepo}
      exportedContent={exportedContent}
      exportedAt={exportedAt}
    />
  );
}
