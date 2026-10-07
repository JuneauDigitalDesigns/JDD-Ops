import { resolve } from 'node:path';
import { redirect } from 'next/navigation';
import type { SiteContent } from '@/data/site';
import { getClientCached } from '@/lib/clients';
import { getOnboardingGate } from '@/lib/onboardingGate';
import { loadIntake, withPlan } from '@/lib/intake';
import { clientDir } from '@/lib/paths';
import { readDraft } from '@/lib/draft';
import { readStudioComposition } from '@/lib/studio-readback';
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

  // What the client's page is ACTUALLY made of, read back out of their exported repo. This
  // is what lets the studio open a live client showing its real sections instead of a blank
  // page — the composition used to exist only in whichever browser last built it.
  const composition = readStudioComposition(params.slug);
  const draftBundle = readDraft(params.slug);

  return <BuildWizard slug={params.slug} seed={seed} composition={composition} draftBundle={draftBundle} />;
}
