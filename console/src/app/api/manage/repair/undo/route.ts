import { NextResponse } from 'next/server';
import { getClientContext } from '@/lib/clients';
import { loadRepairOps } from '@/lib/repairOps';
import { loadRetellApiKey, loadMakeApiKey, loadTeardownCredentials } from '@/lib/opsSecrets';
import { appendAudit } from '@/lib/audit';
import { getUndo, listUndo, markUndone } from '@/lib/undo';

/**
 * Reverse a repair.
 *
 * GET  ?slug=x   the undoable repairs for one client, newest first
 * POST { id }    put that one back
 *
 * The reversal is the same vendor call as the repair, aimed at the recorded `before`. It is
 * deliberately NOT a special "undo" API on the vendor side — there isn't one, and pretending
 * otherwise would mean an undo that behaves differently from the thing it reverses.
 *
 * `markUndone` runs only after the vendor call succeeds. Marking first and then failing
 * would destroy the only record of how to get back, which is the one outcome this whole
 * mechanism exists to prevent.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAKE_ZONE = 'https://us2.make.com/api/v2';

function isLoopback(req: Request): boolean {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug') ?? undefined;
  return NextResponse.json({ entries: listUndo({ slug }) });
}

export async function POST(req: Request) {
  if (!isLoopback(req)) {
    return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  }

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

  const entry = getUndo(id);
  if (!entry) return NextResponse.json({ error: `No undo record ${id}.` }, { status: 404 });
  if (entry.undoneAt) {
    return NextResponse.json({ error: 'That repair has already been undone.' }, { status: 409 });
  }

  const ctx = await getClientContext(entry.slug);
  const site = ctx?.sites.find((s) => s.slug === entry.siteSlug);
  if (!ctx || !site) {
    return NextResponse.json(
      { error: `${entry.slug}/${entry.siteSlug} no longer exists — nothing to restore it on.` },
      { status: 404 },
    );
  }

  const ops = await loadRepairOps();
  let result: { ok: boolean; reason: string | null };

  switch (entry.kind) {
    case 'twilio.voiceUrl':
    case 'twilio.smsUrl': {
      // A recorded `before` of null means the field was genuinely unset. Twilio clears a
      // webhook when given an empty string, so that round-trips correctly.
      const { twilioAccountSid, twilioAuthToken } = loadTeardownCredentials();
      result = await ops.setTwilioWebhook({
        accountSid: twilioAccountSid,
        authToken: twilioAuthToken,
        phoneNumber: site.env.TWILIO_NUMBER,
        field: entry.kind === 'twilio.voiceUrl' ? 'voiceUrl' : 'smsUrl',
        url: typeof entry.before === 'string' ? entry.before : '',
      });
      break;
    }

    case 'retell.webhook':
    case 'retell.agentConfig': {
      const before = (entry.before ?? {}) as Record<string, unknown>;
      if (!Object.keys(before).length) {
        return NextResponse.json({ error: 'The recorded previous value is empty.' }, { status: 422 });
      }
      result = await ops.setRetellAgentConfig({
        apiKey: loadRetellApiKey(),
        agentId: site.env.RETELL_AGENT_ID,
        patch: before,
      });
      break;
    }

    case 'make.scenarioState': {
      if (typeof entry.before !== 'boolean') {
        return NextResponse.json({ error: 'The recorded previous state is not a boolean.' }, { status: 422 });
      }
      // The scenario id isn't on the undo entry — it is recoverable from the summary, but
      // parsing prose to drive a vendor write is exactly the kind of shortcut that breaks
      // silently later. Ask the caller to re-run the sweep and use the finding instead.
      return NextResponse.json(
        {
          error:
            'Undoing a Make activation is not automated: switching a post-call scenario back OFF ' +
            'stops call logging, so it should be a deliberate act in Make rather than a one-click ' +
            'reversal here.',
        },
        { status: 422 },
      );
    }

    default:
      return NextResponse.json({ error: `Cannot undo "${entry.kind}".` }, { status: 422 });
  }

  if (!result.ok) {
    appendAudit({
      slug: entry.slug,
      siteSlug: entry.siteSlug,
      action: 'repair.undo',
      ok: false,
      summary: `Undo failed — ${entry.summary}`,
      detail: { undoId: entry.id, reason: result.reason },
    });
    return NextResponse.json({ error: result.reason ?? 'Undo failed.' }, { status: 502 });
  }

  markUndone(entry.id);
  appendAudit({
    slug: entry.slug,
    siteSlug: entry.siteSlug,
    action: 'repair.undo',
    ok: true,
    summary: `Undid — ${entry.summary}`,
    detail: { undoId: entry.id },
  });

  return NextResponse.json({ ok: true });
}
