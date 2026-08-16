import { notFound, redirect } from 'next/navigation';
import { getClientCached } from '@/lib/clients';
import { isManageable, unmanageableReason, SLUG_RE } from '@/lib/manageSites';
import { findLatestArchiveForSlug } from '@/lib/archive';
import {
  buildPendingClientContext,
  getPendingOnboardRecord,
  pendingKvConfigured,
} from '@/lib/pendingKv';
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
 *
 * One client has no folder at all and still belongs here: a PENDING-ONBOARDING client, who
 * paid through Stripe but hasn't submitted the wizard, so they exist only as a KV record.
 * Every layer below this one already knew that — /c/[slug]/page.tsx, the manage layout and
 * the section page all resolve the KV record — but this layout ran first and 404'd, which
 * made the whole feature unreachable and left the "Pending Onboarding" card on the root
 * index pointing at a dead route.
 */
export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  if (!SLUG_RE.test(params.slug)) notFound();

  let ctx = await getClientCached(params.slug);
  let pending = false;

  if (!ctx) {
    // No folder on disk. Two things can still be true, checked in that order:
    //
    //   1. A pending-onboarding client — live, actionable business state.
    //   2. A torn-down client — history. A bookmark pointing at one deserves better than a
    //      bare 404, so it goes to what's left of the record.
    //
    // A slug realistically can't be both: pending records carry a 30-day TTL and a
    // torn-down client's was consumed when its folder was created. The order is about
    // intent, not conflict resolution.
    //
    // .catch on the KV call only — NOT a try/catch around this whole block, which would
    // swallow the NEXT_REDIRECT that redirect() throws. A KV outage has to degrade to the
    // 404 we'd have shown anyway; it must never become a 500 on every /c/* route.
    const record = pendingKvConfigured()
      ? await getPendingOnboardRecord(params.slug).catch(() => null)
      : null;

    if (record) {
      ctx = buildPendingClientContext(record);
      pending = true;
    } else {
      const archived = findLatestArchiveForSlug(params.slug);
      if (archived) redirect(`/archive/${archived.id}`);
      notFound();
    }
  }

  // Same "past provisioning" floor the reconcile engine's site checks use, and for the
  // same reason: before it, an empty Account tab is the correct state, not a problem.
  const accountReady =
    ctx.detectedStatus === 'provisioned' ||
    ctx.detectedStatus === 'portal-pending' ||
    ctx.detectedStatus === 'live';

  // Evaluated here because isManageable/unmanageableReason are server-only; ClientChrome
  // receives the answers, not the predicates. Unavailable tools stay visible and dimmed
  // with this reason as their tooltip, so these strings are user-facing copy.
  //
  // Manage is force-enabled for a pending client rather than derived: isManageable() is
  // false for the synthetic context (its one site has an empty env), and Manage → Overview
  // is the only place the reminder card lives. Deriving it here would leave the tab dead
  // and the client unreachable all over again.
  const tools = pending
    ? {
        build: {
          enabled: false,
          reason: 'Waiting on the client’s onboarding wizard — there’s no site.ts to build from yet.',
        },
        onboard: {
          enabled: false,
          reason: 'Waiting on the client’s onboarding wizard.',
        },
        manage: { enabled: true, reason: null },
        account: {
          enabled: false,
          reason: 'Nothing to account for until they’ve onboarded and gone live.',
        },
      }
    : {
        build: { enabled: true, reason: null },
        onboard: {
          enabled: ctx.hasIntake,
          reason: ctx.hasIntake ? null : 'No readable site.ts yet — build or import an intake first.',
        },
        manage: { enabled: isManageable(ctx), reason: unmanageableReason(ctx) },
        // Gated on provisioning rather than on a subscription, deliberately. An UNBILLED
        // live client is exactly who this tab exists to surface, so requiring a
        // subscription to open it would hide the most expensive case in the roster.
        account: {
          enabled: accountReady,
          reason: accountReady
            ? null
            : 'Opens once this client is provisioned — there’s no billing or usage history before then.',
        },
      };

  return (
    <ClientProvider ctx={ctx} tools={tools}>
      <ClientChrome />
      {children}
    </ClientProvider>
  );
}
