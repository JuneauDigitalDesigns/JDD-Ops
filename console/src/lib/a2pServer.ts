import 'server-only';
import { accountStoreConfigured, getAccountEmailByUserId, patchSite } from './accountStore';
import type { ClientContext } from './types';

/**
 * Server-side glue the A2P routes share: which of a client's sites have a number to attach,
 * and pushing the derived `a2pStatus` onto each site's portal record.
 */

/** Site slug → E.164 TWILIO_NUMBER, for every site that has one. */
export function siteNumbers(ctx: ClientContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const site of ctx.sites) {
    const n = (site.env.TWILIO_NUMBER ?? '').trim();
    if (n) out[site.slug] = n;
  }
  return out;
}

/**
 * Mirror the derived status onto every site's `PortalSite.a2pStatus` (plan decision 6).
 *
 * Only `a2pStatus` — never `messagingServiceSid`. Who owns that field's source of truth is
 * the orchestrator's §6 item 5, and writing it early would let a portal treat a service whose
 * campaign is still in review as ready. A site with no portal account yet is a normal state,
 * reported as a note.
 */
export async function syncPortalStatus(
  ctx: ClientContext,
  status: string,
): Promise<Array<{ site: string; ok: boolean; note?: string }>> {
  if (!accountStoreConfigured()) return [{ site: ctx.slug, ok: false, note: 'KV not configured — portal status not updated.' }];
  const results: Array<{ site: string; ok: boolean; note?: string }> = [];
  for (const site of ctx.sites) {
    const clerk = (site.env.CLERK_USER_ID ?? '').trim();
    if (!clerk) {
      results.push({ site: site.slug, ok: false, note: 'No CLERK_USER_ID — portal record left alone.' });
      continue;
    }
    try {
      const email = await getAccountEmailByUserId(clerk);
      if (!email) {
        results.push({ site: site.slug, ok: false, note: 'No portal account linked yet.' });
        continue;
      }
      const res = await patchSite(email, site.slug, { a2pStatus: status as never });
      results.push(res.ok ? { site: site.slug, ok: true } : { site: site.slug, ok: false, note: res.error });
    } catch (err) {
      results.push({ site: site.slug, ok: false, note: err instanceof Error ? err.message : 'Portal update failed.' });
    }
  }
  return results;
}
