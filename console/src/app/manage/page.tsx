import { listClientContexts } from '@/lib/clients';
import { rosterBase } from '@/lib/manageSites';
import ManageRoster from '@/components/manage/ManageRoster';

/**
 * /manage — the ops control panel landing: every client with live health signal, opening
 * into the per-client rail + stage shell under /manage/[slug]/[section].
 *
 * The rows are built HERE, on the server, from disk. That read is a few milliseconds, so
 * the client list paints immediately; the health columns arrive separately from
 * /api/manage/roster because one unreachable domain can hold that request open for
 * seconds and must not delay the list.
 */
export const dynamic = 'force-dynamic';

export default async function ManagePage() {
  const clients = await listClientContexts().catch(() => []);
  return <ManageRoster rows={clients.map(rosterBase)} />;
}
