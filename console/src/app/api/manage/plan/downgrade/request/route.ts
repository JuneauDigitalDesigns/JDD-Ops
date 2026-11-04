import { NextResponse } from 'next/server';
import { getClientContext } from '@/lib/clients';
import { appendAudit } from '@/lib/audit';
import { callPortalOps, isLoopback, portalEmailFor, type PlanChangeStatus } from '@/lib/portalPlanChange';

/**
 * A client-requested downgrade (growth → starter), the billing half. Proxies to the agency's
 * `/api/ops/plan-change`, which:
 *
 *   POST    emails the client a link to accept the Starter terms (contract v5.3 §15.2). Their
 *           acceptance schedules the change in Stripe for the end of the period they've paid
 *           for, with no credit (§15.4). Re-POSTing while it awaits acceptance re-sends the email.
 *   GET     reports where it stands, and the plan on the portal record.
 *   DELETE  withdraws it, releasing the Stripe schedule if one was made.
 *
 * Nothing here touches Stripe, the client's env or site.ts. The env/site.ts half is
 * ../execute, which refuses to run until the downgrade has taken effect on the portal record.
 * The flow used to flip the plan everywhere at once, so the client lost Growth the day it was
 * asked for and was credited the unused month.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

async function resolve(slug: string) {
  if (!SLUG_RE.test(slug)) return { error: NextResponse.json({ error: 'Invalid client slug.' }, { status: 400 }) };
  const ctx = await getClientContext(slug);
  if (!ctx) return { error: NextResponse.json({ error: `No client at clients/${slug}.` }, { status: 404 }) };
  if (ctx.sites.length !== 1) {
    return { error: NextResponse.json({ error: `Expected exactly 1 site, found ${ctx.sites.length}.` }, { status: 400 }) };
  }
  const site = ctx.sites[0];
  const email = await portalEmailFor(site.env.CLERK_USER_ID);
  if (!email) {
    return {
      error: NextResponse.json(
        { error: 'No portal account linked to this client, so there is no billing to schedule a change on.' },
        { status: 409 },
      ),
    };
  }
  return { ctx, site, email };
}

export async function GET(req: Request) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  const slug = (new URL(req.url).searchParams.get('slug') ?? '').trim();
  const r = await resolve(slug);
  if ('error' in r) return r.error;
  const out = await callPortalOps<PlanChangeStatus>(
    `/api/ops/plan-change?email=${encodeURIComponent(r.email)}&slug=${encodeURIComponent(r.site.slug)}`,
    { method: 'GET' },
  );
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ...out.body, email: r.email });
}

export async function POST(req: Request) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  let body: { slug?: string };
  try {
    body = (await req.json()) as { slug?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const r = await resolve((body.slug ?? '').trim());
  if ('error' in r) return r.error;

  const out = await callPortalOps<PlanChangeStatus>('/api/ops/plan-change', {
    method: 'POST',
    body: { email: r.email, slug: r.site.slug, plan: 'starter' },
  });
  appendAudit({
    slug: r.ctx.slug,
    siteSlug: r.site.slug,
    action: 'plan.downgrade.request',
    ok: out.ok,
    summary: out.ok
      ? `Downgrade to starter requested; client emailed the Starter terms`
      : `Downgrade request failed: ${out.error}`,
    detail: { to: 'starter' },
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ...out.body, email: r.email });
}

export async function DELETE(req: Request) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  let body: { slug?: string };
  try {
    body = (await req.json()) as { slug?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const r = await resolve((body.slug ?? '').trim());
  if ('error' in r) return r.error;

  const out = await callPortalOps<PlanChangeStatus>('/api/ops/plan-change', {
    method: 'DELETE',
    body: { email: r.email, slug: r.site.slug },
  });
  appendAudit({
    slug: r.ctx.slug,
    siteSlug: r.site.slug,
    action: 'plan.downgrade.withdraw',
    ok: out.ok,
    summary: out.ok ? 'Scheduled downgrade withdrawn' : `Withdrawing the downgrade failed: ${out.error}`,
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ...out.body, email: r.email });
}
