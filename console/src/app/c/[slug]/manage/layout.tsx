import { notFound } from 'next/navigation';
import { getClientCached } from '@/lib/clients';
import { isManageable, SLUG_RE } from '@/lib/manageSites';
import { getPendingOnboardRecord, buildPendingClientContext, pendingKvConfigured } from '@/lib/pendingKv';
import { ManageProvider } from '@/components/manage/ManageContext';
import ManageNavChrome from '@/components/manage/ManageNavChrome';
import ManageRail from '@/components/manage/ManageRail';

/**
 * Manage = the ops control panel: env, deployments, domain, voice agent, portal.
 *
 * Its own `.manage-chrome` scope rather than borrowing `.onboard-chrome`, but the scope is a
 * LAYOUT HOOK now: it carries no tokens. It used to re-accent the whole subtree indigo as a
 * "you are on the write surface" mode signal — that was removed because indigo is not a JDD
 * colour, so it read as a different application rather than a different section. Where you
 * are is signalled by the tool switcher, the rail, and the page title. Its tighter control
 * metrics were right and were promoted to :root for the whole console.
 *
 * `overflow-hidden` + `min-h-0`, NOT `overflow-y-auto`: the rail and the stage each own
 * their own scrolling below this, and a scroll container here would stack a second
 * scrollbar on top of theirs.
 *
 * No dotfield here. It earns its place on the low-density arrival surfaces; over a dense
 * table it is exactly the visual noise this tool is trying to remove.
 *
 * This also carries the manage-specific client gate. The parent /c/[slug] shell admits any
 * client folder — Build has to open for an unprovisioned client — but with no .env.local
 * there are no fields to render and no site slug to address Vercel with, so there is
 * genuinely nothing here.
 *
 * `useSearchParams()` (the ?site= enterprise switcher) needs force-dynamic for the subtree.
 */
export const dynamic = 'force-dynamic';

export default async function ManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  if (!SLUG_RE.test(params.slug)) notFound();

  let ctx = await getClientCached(params.slug);
  if (!ctx || ctx.sites.length === 0 || !isManageable(ctx)) {
    // Disk lookup failed — check KV for a pending-onboarding client (paid, wizard not yet done).
    if (!pendingKvConfigured()) notFound();
    try {
      const pending = await getPendingOnboardRecord(params.slug);
      if (!pending) notFound();
      ctx = buildPendingClientContext(pending);
    } catch {
      notFound();
    }
  }

  return (
    <div className="manage-chrome flex h-full min-h-0 flex-col overflow-hidden">
      <ManageProvider ctx={ctx}>
        <ManageNavChrome />
        <div className="flex min-h-0 flex-1">
          <ManageRail />
          <main className="no-scrollbar min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </ManageProvider>
    </div>
  );
}
