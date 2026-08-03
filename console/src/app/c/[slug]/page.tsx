import { redirect, notFound } from 'next/navigation';
import { getClientCached } from '@/lib/clients';
import { isManageable, SLUG_RE } from '@/lib/manageSites';
import { getPendingOnboardRecord, pendingKvConfigured } from '@/lib/pendingKv';

/**
 * /c/{slug} has no screen of its own — the shell is always showing one of the three tools.
 * Which one depends on where the client actually is, so opening a card from the picker
 * lands on the useful thing rather than a fixed default you'd have to click past.
 *
 * The order matches the pipeline: a provisioned client is one you maintain, an unbuilt one
 * is one you build, and everything between is mid-onboarding.
 */
export default async function ClientIndex({ params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) notFound();

  const ctx = await getClientCached(params.slug);

  if (!ctx) {
    // Check KV — this may be a client who paid but hasn't had their folder created yet.
    if (pendingKvConfigured()) {
      try {
        const pending = await getPendingOnboardRecord(params.slug);
        if (pending) redirect(`/c/${params.slug}/manage/overview`);
      } catch {
        /* fall through to notFound */
      }
    }
    notFound();
  }

  if (isManageable(ctx)) redirect(`/c/${params.slug}/manage`);
  if (!ctx.hasIntake || ctx.detectedStatus === 'needs-build') redirect(`/c/${params.slug}/build`);
  redirect(`/c/${params.slug}/onboard`);
}
