import { notFound, redirect } from 'next/navigation';
import { getManageClient, SLUG_RE } from '@/lib/manageSites';
import { DEFAULT_SECTION, findSection, MANAGE_SECTIONS } from '@/lib/manageSections';
import { getPendingOnboardRecord, buildPendingClientContext, pendingKvConfigured } from '@/lib/pendingKv';
import OverviewSection from '@/components/manage/OverviewSection';
import EnvironmentSection from '@/components/manage/EnvironmentSection';
import DeploymentsSection from '@/components/manage/DeploymentsSection';
import DomainSection from '@/components/manage/DomainSection';
import VoiceAgentSection from '@/components/manage/VoiceAgentSection';
import PortalSection from '@/components/manage/PortalSection';
import DangerSection from '@/components/manage/DangerSection';
import SectionPlaceholder from '@/components/manage/SectionPlaceholder';

/**
 * The stage. One dynamic [section] segment rather than five named folders, so the plan
 * gate and the unknown-section case each live in exactly one place.
 *
 * Two different failure modes, deliberately handled differently:
 *   - A section that exists but not for this plan (voice-agent on a starter client)
 *     REDIRECTS to Overview. It's a real section and the operator followed a stale link;
 *     bouncing them to the client's landing page is more useful than a dead end.
 *   - A section that doesn't exist at all 404s.
 */
export default async function ManageSectionPage({
  params,
}: {
  params: { slug: string; section: string };
}) {
  if (!SLUG_RE.test(params.slug)) notFound();

  let ctx = await getManageClient(params.slug);
  if (!ctx || ctx.sites.length === 0) {
    if (!pendingKvConfigured()) notFound();
    try {
      const pending = await getPendingOnboardRecord(params.slug);
      if (!pending) notFound();
      ctx = buildPendingClientContext(pending);
    } catch {
      notFound();
    }
  }

  const section = findSection(ctx.plan, params.section);
  if (!section) {
    const known = MANAGE_SECTIONS.some((s) => s.id === params.section);
    if (known) redirect(`/c/${params.slug}/manage/${DEFAULT_SECTION}`);
    notFound();
  }

  // Pending-onboarding clients (KV-only, no disk yet): Overview shows the reminder card;
  // every other section is locked until the wizard is submitted.
  if (ctx.pendingOnboarding && section.id !== 'overview') {
    return (
      <SectionPlaceholder
        title={`${section.label} unavailable`}
        message="This section becomes available once the client completes onboarding."
      />
    );
  }

  // Each section owns its own layout width and its own data fetching — they have very
  // different shapes (a 900px form column vs a tile grid), so a shared wrapper here would
  // just be something each one fights.
  switch (section.id) {
    case 'overview':
      return <OverviewSection />;
    case 'environment':
      return <EnvironmentSection />;
    case 'deployments':
      return <DeploymentsSection />;
    case 'domain':
      return <DomainSection />;
    case 'voice-agent':
      return <VoiceAgentSection />;
    case 'portal':
      return <PortalSection />;
    case 'danger':
      return <DangerSection />;
  }
}
