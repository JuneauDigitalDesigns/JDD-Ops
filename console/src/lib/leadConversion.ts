import 'server-only';
import { listClientContexts } from './clients';
import { intakeQueueConfigured, listPendingIntakes } from './intakeQueue';
import { patchLead, type QueuedLead } from './leadQueue';
import { clientRecordsConfigured, ensureClientRecord } from './clientRecord';

/**
 * Close the loop between the funnel and the client roster.
 *
 * A won lead doesn't get marked won by you — it gets marked won by *becoming a client*.
 * They go off and sign, pay, and complete onboarding on the agency site, which lands them
 * in the intake queue and then in `clients/`. Nothing about that flow touches the board,
 * so without this a converted customer sits in "Quoted" forever.
 *
 * `convertLead()` below is now the PRIMARY path: an operator says which lead became which
 * client, and both halves of the link are written from a fact rather than inferred. The
 * name-slug reconciliation here remains as a safety net for the case it was built for —
 * a client who signed up and provisioned without anyone touching the board.
 *
 * Two rules keep the heuristic honest:
 *
 * 1. DISK IS PRIMARY. `markIntakeImported()` removes an intake from the pending index the
 *    moment you claim it, so matching on intakes alone would stop working exactly when it
 *    started mattering. The `clients/` folder is the durable record; intakes only catch
 *    the window between signup and import.
 *
 * 2. IT ONLY EVER MOVES A CARD *TO* WON. Name-slug matching is a heuristic — two
 *    businesses can slugify alike — so the failure mode is capped at "marked won early",
 *    which you can drag back. Letting it move cards the other way would mean a heuristic
 *    could silently undo your own judgement.
 */

/**
 * Bind one lead to one client, explicitly.
 *
 * The link is written in both directions — `clientRecordId` on the lead, `leadId` on the
 * record — because either side alone degrades into the guessing this replaced. Creating
 * the record is idempotent, so converting a lead whose client already has one (the usual
 * case: they were provisioned first, and you are tidying the board afterwards) attaches to
 * it rather than making a second.
 *
 * `email` is optional because a lead captured from a phone call often has no email yet. It
 * falls back to the lead's, and when neither exists no record is created — the lead is
 * still marked won, and the backfill or onboard.js will create the record from disk later.
 * Marking a won deal won should never be blocked on an address nobody collected.
 */
export async function convertLead(
  lead: QueuedLead,
  slug: string,
  opts: { email?: string; siteSlugs?: string[] } = {},
): Promise<QueuedLead | null> {
  const email = (opts.email ?? lead.email ?? '').trim();

  let clientRecordId: string | undefined;
  if (email && clientRecordsConfigured()) {
    const record = await ensureClientRecord({
      email,
      slug,
      siteSlugs: opts.siteSlugs,
      leadId: lead.id,
      stage: 'won',
    });
    clientRecordId = record.id;
  }

  return patchLead(lead.id, {
    stage: 'won',
    convertedSlug: slug,
    ...(clientRecordId ? { clientRecordId } : {}),
    activity: {
      kind: 'converted',
      text: `Converted to client — ${slug}${clientRecordId ? '' : ' (no email on file, record deferred)'}`,
    },
  });
}

/** Match intake's slugifyBrand exactly, or the two sides won't line up. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

/**
 * Mark any lead that has since become a client as won, and return the updated list.
 *
 * Writes only for leads that actually changed, so a board refresh on a settled funnel
 * costs zero KV writes.
 */
export async function reconcileWon(leads: QueuedLead[]): Promise<QueuedLead[]> {
  const candidates = leads.filter(
    (l) => l.stage !== 'won' && l.stage !== 'lost' && l.businessName?.trim(),
  );
  if (!candidates.length) return leads;

  // slug → the thing it resolves to, for the activity line.
  const taken = new Map<string, string>();

  for (const ctx of await listClientContexts({ includeFixtures: false })) {
    taken.set(ctx.slug, ctx.slug);
    // An enterprise client's sites carry their own slugs; any of them is proof enough.
    for (const site of ctx.sites) taken.set(site.slug, ctx.slug);
  }

  if (intakeQueueConfigured()) {
    try {
      for (const intake of await listPendingIntakes()) {
        if (!taken.has(intake.slugGuess)) taken.set(intake.slugGuess, intake.slugGuess);
      }
    } catch {
      // Intake is the optional half — disk already covers everything already imported.
    }
  }

  const updates = new Map<string, QueuedLead>();
  for (const lead of candidates) {
    const slug = slugify(lead.businessName);
    const hit = slug && taken.get(slug);
    if (!hit) continue;

    // Route through convertLead so the heuristic and the explicit action write the same
    // shape. The record work only runs for a lead that actually matched, preserving the
    // zero-writes-on-a-settled-funnel property: `candidates` already excludes won/lost.
    const updated = await convertLead(lead, hit);
    if (updated) updates.set(lead.id, updated);
  }

  if (!updates.size) return leads;
  return leads.map((l) => updates.get(l.id) ?? l);
}
