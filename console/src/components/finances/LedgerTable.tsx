'use client';

import { useMemo, useRef, useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import type { LedgerEntry, LedgerKind } from '@/lib/financeTypes';
import {
  dateLabel,
  money,
  parseDollarsToCents,
  todayIso,
} from '@/lib/financeFormat';

/**
 * The shared ledger table: an always-ready inline row on top, click-to-edit rows below.
 *
 * Used by all three ledgers. Expenses get a category column; draws and reserve transfers don't,
 * because neither is a business cost with a kind (see financeTypes.ts).
 *
 * ── Why inline-add rather than a dialog ─────────────────────────────────────────────────────
 *
 * The owner enters a handful of rows at a sitting, once a month. A dialog costs a click to open
 * and a click to dismiss per row; an always-present row costs nothing and lets Enter commit and
 * refocus for the next one. The amount field keeps focus after a save precisely so a run of
 * subscriptions can be typed without touching the mouse.
 */

export interface LedgerTableProps {
  kind: LedgerKind;
  entries: LedgerEntry[];
  categories: string[];
  /** Rendered above the rows as a non-editable, Stripe-derived line. Expenses only. */
  stripeFeesCents?: number;
  /** Month filter as YYYY-MM, set by clicking the chart. */
  filterMonth?: string | null;
  onCreate: (draft: { date: string; amountCents: number; category?: string; note?: string }) => Promise<void>;
  onPatch: (id: string, patch: Partial<Pick<LedgerEntry, 'date' | 'amountCents' | 'category' | 'note'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  emptyHint: string;
}

export default function LedgerTable({
  kind,
  entries,
  categories,
  stripeFeesCents,
  filterMonth,
  onCreate,
  onPatch,
  onDelete,
  emptyHint,
}: LedgerTableProps) {
  const usesCategory = kind === 'expense';

  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0] ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(
    () => (filterMonth ? entries.filter((e) => e.date.startsWith(filterMonth)) : entries),
    [entries, filterMonth],
  );

  const total = useMemo(
    () => visible.reduce((sum, e) => sum + e.amountCents, 0),
    [visible],
  );

  async function submit() {
    const cents = parseDollarsToCents(amount);
    if (cents === null) {
      setError('Enter an amount greater than zero.');
      amountRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        date,
        amountCents: cents,
        ...(usesCategory ? { category } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      // Keep the date and category — a run of entries usually shares both. Clear only what
      // differs row to row, and hand focus back so the next one can be typed straight away.
      setAmount('');
      setNote('');
      amountRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that entry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule text-left">
              <Th className="w-[7.5rem]">Date</Th>
              {usesCategory && <Th className="w-[9rem]">Category</Th>}
              <Th>Note</Th>
              <Th className="w-[8rem] text-right">Amount</Th>
              <Th className="w-10" />
            </tr>
          </thead>

          <tbody>
            {/* The always-ready new row. */}
            <tr className="border-b border-rule bg-[var(--surface-2)]/50">
              <Td>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input h-8 w-full px-2 text-xs"
                  aria-label="Date"
                />
              </Td>
              {usesCategory && (
                <Td>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input h-8 w-full px-2 text-xs"
                    aria-label="Category"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Td>
              )}
              <Td>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="optional note"
                  className="input h-8 w-full px-2 text-xs"
                  aria-label="Note"
                />
              </Td>
              <Td className="text-right">
                <input
                  ref={amountRef}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="input h-8 w-full px-2 text-right text-xs tabular-nums"
                  aria-label="Amount in dollars"
                />
              </Td>
              <Td>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="btn btn-xs btn-primary flex h-8 w-8 items-center justify-center p-0 disabled:opacity-50"
                  title="Add entry (or press Enter)"
                  aria-label="Add entry"
                >
                  <Plus size={13} weight="bold" />
                </button>
              </Td>
            </tr>

            {/* Stripe's fee line — real, deductible, and not editable because it is derived. */}
            {usesCategory && stripeFeesCents !== undefined && stripeFeesCents > 0 && (
              <tr className="border-b border-rule text-fg2">
                <Td className="text-xs">—</Td>
                <Td className="text-xs">fees</Td>
                <Td className="text-xs">
                  Stripe processing fees
                  <span className="meta ml-2 rounded border border-rule px-1.5 py-0.5">
                    auto, from Stripe
                  </span>
                </Td>
                <Td className="text-right text-xs tabular-nums">{money(stripeFeesCents)}</Td>
                <Td />
              </tr>
            )}

            {visible.map((entry) => (
              <Row
                key={entry.id}
                entry={entry}
                usesCategory={usesCategory}
                categories={categories}
                onPatch={onPatch}
                onDelete={onDelete}
              />
            ))}

            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={usesCategory ? 5 : 4}
                  className="px-3 py-10 text-center text-xs text-fg3"
                >
                  {filterMonth ? 'Nothing logged in this month.' : emptyHint}
                </td>
              </tr>
            )}
          </tbody>

          {visible.length > 0 && (
            <tfoot>
              <tr className="border-t border-ruleStrong">
                <Td className="text-xs font-medium" colSpan={usesCategory ? 3 : 2}>
                  {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
                  {filterMonth ? ' in this month' : ''}
                  {usesCategory && stripeFeesCents ? ' + Stripe fees' : ''}
                </Td>
                <Td className="text-right text-sm font-semibold tabular-nums">
                  {money(total + (usesCategory ? (stripeFeesCents ?? 0) : 0))}
                </Td>
                <Td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/* ── Row ────────────────────────────────────────────────────────────────────────────────────
 *
 * Each cell swaps to an input on click and commits on blur or Enter, reverting on Escape. The
 * commit only fires when the value actually changed, so clicking into a field and back out does
 * not write a pointless revision.
 */
function Row({
  entry,
  usesCategory,
  categories,
  onPatch,
  onDelete,
}: {
  entry: LedgerEntry;
  usesCategory: boolean;
  categories: string[];
  onPatch: LedgerTableProps['onPatch'];
  onDelete: LedgerTableProps['onDelete'];
}) {
  const [editing, setEditing] = useState<'date' | 'amount' | 'note' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <tr className="group border-b border-rule last:border-0 hover:bg-[var(--surface-2)]/40">
      <Td>
        {editing === 'date' ? (
          <input
            type="date"
            defaultValue={entry.date}
            autoFocus
            onBlur={(e) => {
              if (e.target.value && e.target.value !== entry.date) {
                void onPatch(entry.id, { date: e.target.value });
              }
              setEditing(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditing(null);
            }}
            className="input h-7 w-full px-2 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing('date')}
            className="w-full rounded px-1 py-0.5 text-left text-xs hover:bg-[var(--surface-2)]"
          >
            {dateLabel(entry.date)}
          </button>
        )}
      </Td>

      {usesCategory && (
        <Td>
          <select
            value={entry.category ?? ''}
            onChange={(e) => void onPatch(entry.id, { category: e.target.value })}
            className="h-7 w-full cursor-pointer rounded border border-transparent bg-transparent px-1 text-xs hover:border-rule hover:bg-[var(--surface-2)]"
            aria-label="Category"
          >
            {/* A category removed from settings after this row was written would otherwise
                vanish from the select and silently re-save as something else on next edit. */}
            {!categories.includes(entry.category ?? '') && entry.category && (
              <option value={entry.category}>{entry.category} (removed)</option>
            )}
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Td>
      )}

      <Td>
        {editing === 'note' ? (
          <input
            defaultValue={entry.note ?? ''}
            autoFocus
            onBlur={(e) => {
              if (e.target.value !== (entry.note ?? '')) {
                void onPatch(entry.id, { note: e.target.value });
              }
              setEditing(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditing(null);
            }}
            className="input h-7 w-full px-2 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing('note')}
            className="w-full rounded px-1 py-0.5 text-left text-xs text-fg2 hover:bg-[var(--surface-2)]"
          >
            {entry.note || <span className="text-fg3">—</span>}
          </button>
        )}
      </Td>

      <Td className="text-right">
        {editing === 'amount' ? (
          <input
            defaultValue={(entry.amountCents / 100).toFixed(2)}
            autoFocus
            inputMode="decimal"
            onBlur={(e) => {
              const cents = parseDollarsToCents(e.target.value);
              if (cents !== null && cents !== entry.amountCents) {
                void onPatch(entry.id, { amountCents: cents });
              }
              setEditing(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditing(null);
            }}
            className="input h-7 w-full px-2 text-right text-xs tabular-nums"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing('amount')}
            className="w-full rounded px-1 py-0.5 text-right text-xs tabular-nums hover:bg-[var(--surface-2)]"
          >
            {money(entry.amountCents)}
          </button>
        )}
      </Td>

      <Td>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void onDelete(entry.id)}
              className="btn btn-xs btn-danger h-7 px-1.5"
              title="Confirm delete"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="btn btn-xs h-7 px-1.5"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex h-7 w-7 items-center justify-center rounded text-fg3 opacity-0 transition-opacity hover:bg-[var(--surface-2)] hover:text-danger focus:opacity-100 group-hover:opacity-100"
            title="Delete entry"
            aria-label="Delete entry"
          >
            <Trash size={13} />
          </button>
        )}
      </Td>
    </tr>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-meta font-medium uppercase tracking-wide text-fg3 ${className}`}>{children}</th>;
}

function Td({
  children,
  className = '',
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-3 py-1.5 align-middle ${className}`}>
      {children}
    </td>
  );
}
