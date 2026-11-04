import { notFound } from 'next/navigation';
import { resumeStepFor } from '@jdd/schema';
import { getLead, leadQueueConfigured } from '@/lib/leadQueue';
import { a2pSummary, readOrderByLead } from '@/lib/salesOrders';
import { loadA2pEnums } from '@/lib/a2pChain';
import { VERTICALS } from '@/lib/verticals';
import CloseWizard from '@/components/close/CloseWizard';

export const dynamic = 'force-dynamic';

/**
 * Close a lead on a sales call: order → terms → payment → setup → SMS registration → done.
 *
 * Also the Resume screen. The wizard keeps no state of its own; this page reads the order and the
 * A2P record and opens at the first unfinished step (`resumeStepFor`, shared with the agency and
 * the roster), so a close abandoned mid-call picks up exactly where it stopped and nothing before
 * that point can be redone.
 *
 * The client usually watches this over a screen share, so everything it renders is written for
 * them: labels and short instructions, no operator notes, ids or hashes.
 */
export default async function CloseOnCallPage({ params }: { params: { id: string } }) {
  if (!leadQueueConfigured()) notFound();
  const lead = await getLead(params.id);
  if (!lead) notFound();

  const order = await readOrderByLead(lead.id);
  const activeOrder = order && order.status !== 'cancelled' ? order : null;
  const a2p = activeOrder ? await a2pSummary(activeOrder.siteSlug) : { status: null, needsEin: false };
  const initialStep = resumeStepFor({ order: activeOrder, a2pStatus: a2p.status });
  const enums = await loadA2pEnums().catch(() => null);

  return (
    <CloseWizard
      lead={{
        id: lead.id,
        name: lead.name,
        businessName: lead.businessName,
        phone: lead.phone,
        email: lead.email ?? '',
        planInterest: lead.planInterest,
        trade: lead.trade ?? null,
      }}
      initialOrder={activeOrder}
      initialStep={initialStep}
      verticals={VERTICALS.map((v) => ({ id: v.id, label: v.label }))}
      a2pEnums={enums}
    />
  );
}
