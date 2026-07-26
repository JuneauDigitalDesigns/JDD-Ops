import { notFound, redirect } from 'next/navigation';
import { getManageClient, SLUG_RE } from '@/lib/manageSites';
import { DEFAULT_SECTION, findSection, MANAGE_SECTIONS } from '@/lib/manageSections';
import SectionHeader from '@/components/manage/SectionHeader';

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

  const ctx = await getManageClient(params.slug);
  if (!ctx || ctx.sites.length === 0) notFound();

  const section = findSection(ctx.plan, params.section);
  if (!section) {
    const known = MANAGE_SECTIONS.some((s) => s.id === params.section);
    if (known) redirect(`/manage/${params.slug}/${DEFAULT_SECTION}`);
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-8 py-8 lg:px-10">
      <SectionHeader title={section.label} lede={section.lede} />
      <div className="panel p-5 text-sm text-fg3">
        {section.label} section — built in the next phase.
      </div>
    </div>
  );
}
