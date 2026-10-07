import { redirect } from 'next/navigation';
import OnboardTool from '@/components/client/OnboardTool';
import { getClientCached } from '@/lib/clients';
import { getOnboardingGate } from '@/lib/onboardingGate';

// OnboardTool is a client component that fetches /api/runbook/clients and renders the
// runbook for this slug. Force dynamic so it never gets statically cached.
export const dynamic = 'force-dynamic';

export default async function OnboardPage({ params }: { params: { slug: string } }) {
  // Second layer of the onboarding gate; see the build page. A pending-onboarding client has
  // no ctx here (no folder) and is already handled by the layout, so only real folders are checked.
  const ctx = await getClientCached(params.slug);
  if (ctx && !(await getOnboardingGate(ctx)).onboarded) redirect(`/c/${params.slug}/manage/overview`);

  return <OnboardTool slug={params.slug} />;
}
