import { notFound } from 'next/navigation';
import { getManageClient, isManageable, SLUG_RE } from '@/lib/manageSites';
import { ManageProvider } from '@/components/manage/ManageContext';
import ManageNavChrome from '@/components/manage/ManageNavChrome';
import ManageRail from '@/components/manage/ManageRail';

/**
 * The per-client shell: rail on the left, section on the right.
 *
 * A SERVER component that loads ClientContext once and hands it to the client provider.
 * App Router keeps a layout mounted across sibling segment changes, so moving between
 * sections re-renders only the page — the rail keeps its scroll position and the client
 * is never refetched. That persistence is the reason sections are route segments.
 */
export default async function ManageClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  if (!SLUG_RE.test(params.slug)) notFound();

  const ctx = await getManageClient(params.slug);
  // `sites: []` means no readable site.ts — there is no plan to build a rail from and no
  // site slug to address Vercel with, so there is genuinely nothing to manage.
  if (!ctx || ctx.sites.length === 0 || !isManageable(ctx)) notFound();

  return (
    <ManageProvider ctx={ctx}>
      <ManageNavChrome />
      <div className="flex min-h-0 flex-1">
        <ManageRail />
        <main className="no-scrollbar min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </ManageProvider>
  );
}
