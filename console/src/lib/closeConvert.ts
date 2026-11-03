import 'server-only';
import { isOrderPaid, type OperatorOrder } from '@jdd/schema';
import { getLead } from './leadQueue';
import { convertLead } from './leadConversion';
import { resolveRepoRoot, seedClientFolder } from './export';
import { agencyOrders } from './salesOrders';
import { appendAudit } from './audit';

export interface ConvertStepResult {
  id: 'folder' | 'lead' | 'recorded';
  ok: boolean;
  detail: string;
}

/**
 * Turn a paid operator order into a console client: `clients/<slug>/site.ts` from the vertical
 * preset, the lead ↔ client record link, and the agency told it's done.
 *
 * Runs from the wizard's Setup step, and from the Leads page for any order a client paid later
 * from their link. Safe to run twice:
 *
 *   - the folder already existing under THIS order's slug counts as success. The slug was locked
 *     at order time and claimed against every other order, so a folder with that name is this
 *     client's — most likely the intake import got there first (design §3 edge case);
 *   - a lead already converted to this slug is left alone;
 *   - the agency keeps its first `convertedAt`.
 */
export async function convertPaidOrder(order: OperatorOrder): Promise<{ ok: boolean; steps: ConvertStepResult[] }> {
  const steps: ConvertStepResult[] = [];
  if (!isOrderPaid(order.status)) {
    return { ok: false, steps: [{ id: 'folder', ok: false, detail: 'The order isn’t paid yet.' }] };
  }
  const slug = order.siteSlug;
  const name = order.client.dba || order.client.legalName;

  try {
    seedClientFolder({ repoRoot: resolveRepoRoot(), slug, name, plan: order.plan, vertical: order.vertical });
    steps.push({ id: 'folder', ok: true, detail: `Site ID ${slug}` });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'EXISTS') {
      steps.push({ id: 'folder', ok: true, detail: `Site ID ${slug}` });
    } else {
      const message = e instanceof Error ? e.message : 'Could not create the client folder.';
      steps.push({ id: 'folder', ok: false, detail: message });
      audit(order, false, `Convert failed creating clients/${slug}`);
      return { ok: false, steps };
    }
  }

  const lead = await getLead(order.leadId);
  if (!lead) {
    steps.push({ id: 'lead', ok: false, detail: 'The lead no longer exists.' });
  } else if (lead.convertedSlug === slug) {
    steps.push({ id: 'lead', ok: true, detail: 'Moved to Clients' });
  } else {
    const updated = await convertLead(lead, slug, { email: order.client.email });
    steps.push({ id: 'lead', ok: Boolean(updated), detail: updated ? 'Moved to Clients' : 'Could not update the lead.' });
  }

  const recorded = await agencyOrders(`/${encodeURIComponent(order.id)}/mark-converted`, { method: 'POST', body: {} });
  steps.push({
    id: 'recorded',
    ok: recorded.status < 300,
    detail: recorded.status < 300 ? 'Recorded' : String(recorded.body.error ?? 'Could not record the conversion.'),
  });

  const ok = steps.every((s) => s.ok);
  audit(order, ok, ok ? `Converted to client ${slug}` : `Convert of ${slug} incomplete`);
  return { ok, steps };
}

function audit(order: OperatorOrder, ok: boolean, summary: string) {
  appendAudit({
    slug: order.siteSlug,
    action: 'close.convert',
    ok,
    summary,
    detail: { orderId: order.id, plan: order.plan },
  });
}
