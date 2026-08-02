import { notFound } from 'next/navigation';
import { getClientCached } from '@/lib/clients';
import { isManageable, unmanageableReason, SLUG_RE } from '@/lib/manageSites';
import { ClientProvider } from '@/components/client/ClientProvider';
import ClientChrome from '@/components/client/ClientChrome';

/**
 * The per-client shell — the console's central idea: you pick a client once, at the root,
 * and then Build / Onboard / Manage are things you do TO that client rather than three
 * separate tools that each ask who you meant.
 *
 * A SERVER component that loads ClientContext once and hands it to the client provider.
 * App Router keeps a layout mounted across sibling segment changes, so moving between
 * tools re-renders only the tool — the client is never refetched. That persistence is the
 * reason the tools are route segments.
 *
 * The gate here is deliberately LOW: the folder exists, that's all. A client with no
 * .env.local still needs Build to open, so per-tool availability is handled by dimming
 * tabs in ClientChrome and by the manage segment's own notFound() guard — not here.
 */
export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  if (!SLUG_RE.test(params.slug)) notFound();

  const ctx = await getClientCached(params.slug);
  if (!ctx) notFound();

  // Evaluated here because isManageable/unmanageableReason are server-only; ClientChrome
  // receives the answers, not the predicates.
  const tools = {
    build: { enabled: true, reason: null },
    onboard: {
      enabled: ctx.hasIntake,
      reason: ctx.hasIntake ? null : 'No readable site.ts yet — build or import an intake first.',
    },
    manage: { enabled: isManageable(ctx), reason: unmanageableReason(ctx) },
  };

  return (
    <ClientProvider ctx={ctx} tools={tools}>
      <ClientChrome />
      {children}
    </ClientProvider>
  );
}
