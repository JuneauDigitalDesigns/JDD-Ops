import 'server-only';
import { listClientContexts } from './clients';
import { intakeQueueConfigured, listPendingIntakes } from './intakeQueue';
import { patchLead, type QueuedLead } from './leadQueue';

/**
 * Close the loop between the funnel and the client roster.
 *
 * A won lead doesn't get marked won by you — it gets marked won by *becoming a client*.
 * They go off and sign, pay, and complete onboarding on the agency site, which lands them
 * in the intake queue and then in `clients/`. Nothing about that flow touches the board,
 * so without this a converted customer sits in "Quoted" forever.
 *
 * Two rules keep this honest:
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

    const updated = await patchLead(lead.id, {
      stage: 'won',
      convertedSlug: hit,
      activity: { kind: 'converted', text: `Became a client — ${hit}` },
    });
    if (updated) updates.set(lead.id, updated);
  }

  if (!updates.size) return leads;
  return leads.map((l) => updates.get(l.id) ?? l);
}
