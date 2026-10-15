'use client';

import { money } from '@/lib/financeFormat';
import type { QuarterDue } from '@/lib/taxEstimate';

/**
 * The four federal estimated-payment deadlines, with what to send and whether it has passed.
 *
 * Two things are worth saying plainly on this panel rather than leaving to be discovered:
 *
 *   1. Q4 is due in JANUARY OF THE FOLLOWING YEAR. People reliably think of a tax year as
 *      self-contained and miss it.
 *   2. The split is even. That is the right default for a planning tool built around a monthly
 *      habit, but it is not the annualized-income method, which can lower what is actually owed
 *      for a quarter when income is lumpy. Saying so costs one line and prevents the owner from
 *      mistaking an estimate for a filing.
 */

export default function QuarterlyTable({
  quarters,
  taxYear,
}: {
  quarters: QuarterDue[];
  taxYear: number;
}) {
  const next = quarters.find((q) => !q.past);

  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule text-left">
            <th className="px-3 py-2 text-meta font-medium uppercase tracking-wide text-fg3">
              Quarter
            </th>
            <th className="px-3 py-2 text-meta font-medium uppercase tracking-wide text-fg3">
              Due
            </th>
            <th className="px-3 py-2 text-right text-meta font-medium uppercase tracking-wide text-fg3">
              Amount
            </th>
            <th className="px-3 py-2 text-right text-meta font-medium uppercase tracking-wide text-fg3">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {quarters.map((q) => {
            const isNext = next?.quarter === q.quarter;
            return (
              <tr
                key={q.quarter}
                className={`border-b border-rule last:border-0 ${isNext ? 'bg-[var(--surface-2)]' : ''}`}
              >
                <td className="px-3 py-2 text-xs">
                  Q{q.quarter}
                  {q.quarter === 4 && (
                    <span className="meta ml-1.5 text-fg3">(paid in {taxYear + 1})</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs tabular-nums">
                  {new Date(`${q.dueDate}T00:00:00Z`).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">
                  {money(q.amountCents)}
                </td>
                <td className="px-3 py-2 text-right">
                  {q.past ? (
                    <span className="badge text-fg3">passed</span>
                  ) : isNext ? (
                    <span className="badge badge-accent">next</span>
                  ) : (
                    <span className="badge text-fg3">upcoming</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="meta mt-3 leading-relaxed text-fg3">
        Federal estimated payments (Form 1040-ES), split evenly across the year. If your income is
        lumpy, the annualized-income method can lower what&rsquo;s actually owed in a given
        quarter. Dates shift off weekends automatically — confirm against the IRS calendar for
        federal holidays.
      </p>
    </div>
  );
}
