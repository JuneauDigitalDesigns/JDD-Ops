'use client';

import { CloudArrowDown, Warning } from '@phosphor-icons/react';
import PlanChip from '@/components/PlanChip';
import { relativeTime } from '@/lib/relativeTime';
import type { IntakeSummary } from '@/lib/useIntakeQueue';

/**
 * A pending signup, sitting in the client grid ahead of real clients.
 *
 * ── Why it's in the grid ────────────────────────────────────────────────────────────────
 * This used to be a separate strip above the roster, which framed a new signup as a
 * notification ABOUT the list. It isn't — it's a member of the list that hasn't been claimed
 * yet. Putting it in the grid at the front means new work is the first thing on the screen.
 * A search query drops this ordering — see `entries` in ClientIndex — so a match is never
 * buried behind an unrelated signup.
 *
 * ── Why it looks different ──────────────────────────────────────────────────────────────
 * It must not read as a client, because you cannot do anything to it yet: there is no
 * clients/<slug>/ folder, so Build, Onboard and Manage have nothing to open. Three signals
 * separate it from <ClientCard>:
 *
 *   • A solid ACCENT border and an accent-tinted ground, where client cards sit on the plain
 *     panel surface. It reads as lit up / incoming.
 *   • An accent top band. Client cards use that band for the client's own brand colour, so
 *     the same band in the app's accent says "this one has no brand of its own yet".
 *   • It says what it is ("New signup") and what to do ("Import"), because the whole card is
 *     one action rather than a link into three tools.
 *
 * It is deliberately NOT a dashed treatment. Dashed means "nothing is here yet"; a signup is
 * real data waiting on a decision.
 */
export default function IntakeCard({
  intake,
  onImport,
  busy,
}: {
  intake: IntakeSummary;
  onImport: () => void;
  busy: boolean;
}) {
  // The wash is a literal teal rgba rather than --accent-glow, which is keyed to --accent-2
  // (coral) — a naming trap left from when primary buttons owned the glow. It has to match
  // the teal border.
  const WASH = 'rgba(31, 111, 120, 0.07)';

  return (
    <button
      type="button"
      onClick={onImport}
      disabled={busy}
      title={`Import ${intake.brandName} — creates clients/${intake.slugGuess}/site.ts`}
      className="group relative flex flex-col overflow-hidden rounded-panel border text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
      style={{ borderColor: 'var(--accent)', background: WASH }}
    >
      <span aria-hidden className="h-1 w-full shrink-0" style={{ background: 'var(--accent)' }} />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <CloudArrowDown size={14} weight="fill" style={{ color: 'var(--accent)' }} />
          <span className="kicker" style={{ color: 'var(--accent)' }}>
            New signup
          </span>
          <span className="meta ml-auto shrink-0">{relativeTime(intake.receivedAt)}</span>
        </div>

        <div className="min-w-0">
          <h3 className="font-display text-[22px] font-semibold leading-[1.15] tracking-tightish text-fg">
            {intake.brandName}
          </h3>
          {/* The slug GUESS, not a slug. Nothing has been written yet, and the import sheet
              is where it gets confirmed — so this is shown as a proposal, not an address. */}
          <p className="meta mt-0.5 truncate">{intake.slugGuess}</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <PlanChip plan={intake.plan} />
          {intake.missingFieldsCount > 0 && (
            <span className="flex items-center gap-1 text-2xs" style={{ color: 'var(--warn)' }}>
              <Warning size={12} weight="fill" />
              {intake.missingFieldsCount} field{intake.missingFieldsCount === 1 ? '' : 's'} to review
            </span>
          )}
          <span
            className="ml-auto shrink-0 text-xs font-medium transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            {busy ? 'Importing…' : 'Import →'}
          </span>
        </div>
      </div>
    </button>
  );
}
