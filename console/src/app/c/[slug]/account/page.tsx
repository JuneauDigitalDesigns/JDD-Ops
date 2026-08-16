import { notFound } from 'next/navigation';
import { getClientCached } from '@/lib/clients';
import AccountView from '@/components/manage/AccountView';

/**
 * The fourth phase: what this relationship is worth and whether it is healthy.
 *
 * Deliberately NOT a section inside Manage. Manage answers "is the infrastructure right",
 * and its rail is env vars, deploys and domains — operational questions with operational
 * answers. This answers "are they paying, are they getting value, are they about to
 * leave", which is a different job on a different cadence, and putting money next to env
 * vars would bury it.
 */
export const dynamic = 'force-dynamic';

export default async function AccountPage({ params }: { params: { slug: string } }) {
  const ctx = await getClientCached(params.slug);
  if (!ctx) notFound();
  return <AccountView slug={ctx.slug} />;
}
