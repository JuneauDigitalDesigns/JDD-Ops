'use client';

import { Flask, MagnifyingGlass, Plus, Warning } from '@phosphor-icons/react';
import type { Plan } from '@/lib/types';

export type SortKey = 'touched' | 'name' | 'status' | 'health';

export const SORT_LABEL: Record<SortKey, string> = {
  touched: 'Last touched',
  name: 'Name',
  status: 'Pipeline status',
  health: 'Health',
};

const PLANS: Plan[] = ['starter', 'growth', 'enterprise'];

/**
 * Search, sort and filters for the client grid.
 *
 * Status isn't a filter here on purpose — it's a sort. Filtering would hide clients rather than
 * rank them, and the sort already floats the ones needing work to the top without making the
 * rest disappear. (This used to defer to the /pipeline board for stage filtering; that board is
 * gone, and the reasoning stands on its own without it.)
 *
 * Fixtures live here rather than in the console bar. They ARE a filter — include the
 * `_`-prefixed test folders or don't — and a filter that changes what this grid shows belongs
 * with the other filters, not in chrome shared with every other route.
 */
export default function IndexControls({
  query, onQuery,
  sort, onSort,
  plans, onTogglePlan,
  attentionOnly, onToggleAttentionOnly,
  attentionCount,
  showFixtures, onToggleFixtures,
  shown, total,
  onNew,
}: {
  query: string;
  onQuery: (v: string) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  plans: Set<Plan>;
  onTogglePlan: (p: Plan) => void;
  attentionOnly: boolean;
  onToggleAttentionOnly: () => void;
  attentionCount: number;
  showFixtures: boolean;
  onToggleFixtures: () => void;
  shown: number;
  total: number;
  onNew: () => void;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onNew} className="btn shrink-0">
          <Plus size={14} weight="bold" /> New client
        </button>

        <div className="relative min-w-[220px] flex-1">
          <MagnifyingGlass
            size={14}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--fg-3)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search clients…"
            autoFocus
            // Inline, not `pl-9`: globals.css sets `.onboard-chrome input[type='search']
            // { padding: 0 12px }` outside a @layer, so it beats Tailwind's layered
            // utilities and the placeholder renders under the icon.
            style={{ paddingLeft: 34 }}
            className="w-full pr-3 text-sm"
          />
        </div>

        <label className="flex items-center gap-2">
          <span className="meta whitespace-nowrap">Sort</span>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            className="text-sm"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="meta">Plan</span>
        {PLANS.map((p) => {
          const on = plans.has(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => onTogglePlan(p)}
              aria-pressed={on}
              className="btn btn-xs capitalize"
              style={
                on
                  ? { background: 'var(--surface-2)', color: 'var(--fg)', borderColor: 'var(--rule-strong)' }
                  : { color: 'var(--fg-3)' }
              }
            >
              {p}
            </button>
          );
        })}

        <span className="mx-1 h-4 w-px shrink-0" style={{ background: 'var(--rule)' }} />

        <button
          type="button"
          onClick={onToggleAttentionOnly}
          aria-pressed={attentionOnly}
          disabled={attentionCount === 0}
          title={attentionCount === 0 ? 'Nothing needs attention' : undefined}
          className="btn btn-xs"
          style={
            attentionOnly
              ? { background: 'var(--warn-glow)', color: 'var(--warn)', borderColor: 'var(--warn)' }
              : attentionCount === 0
                ? { color: 'var(--fg-3)', opacity: 0.5 }
                // This chip is now the ONLY always-visible surface for "something's wrong" —
                // AttentionStrip is gone. Give it the warn color at rest, not just when
                // pressed, so a live problem still catches the eye without a banner.
                : { color: 'var(--warn)', borderColor: 'var(--warn)' }
          }
        >
          <Warning size={12} weight="fill" /> Needs attention
          {attentionCount > 0 ? ` · ${attentionCount}` : ''}
        </button>

        {/* Off by default: clients/ holds a handful of `_e2e*` folders the provisioning tests
            run against, and a front door that is half test data is not a front door. */}
        <button
          type="button"
          onClick={onToggleFixtures}
          aria-pressed={showFixtures}
          title="Include the _e2e test fixtures alongside real clients"
          className="btn btn-xs"
          style={
            showFixtures
              ? { background: 'var(--surface-2)', color: 'var(--fg)', borderColor: 'var(--rule-strong)' }
              : { color: 'var(--fg-3)' }
          }
        >
          <Flask size={12} weight="fill" /> Fixtures
        </button>

        <span className="meta ml-auto text-fg3">
          {shown === total ? `${total} client${total === 1 ? '' : 's'}` : `${shown} of ${total}`}
        </span>
      </div>
    </div>
  );
}
