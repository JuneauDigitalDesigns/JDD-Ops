'use client';

import { useState } from 'react';
import type { FinanceSettings } from '@/lib/financeTypes';
import { money, parseDollarsToCents } from '@/lib/financeFormat';

/**
 * Tax constants and expense categories.
 *
 * These live in storage rather than in code because every one of them changes annually, and a
 * figure that decides what the owner sends the IRS should be fixable in thirty seconds. The
 * shipped defaults were verified against IRS Rev. Proc. 2025-32 and the SSA 2026 COLA fact sheet
 * — the citations are in financeTypes.ts, and the panel points at them rather than asking anyone
 * to take the numbers on trust.
 *
 * Brackets are deliberately NOT editable here. The table is seven rows of three interdependent
 * numbers where a plausible-looking typo silently taxes at the wrong rate rather than failing,
 * and nothing about the annual update is served by hand-typing it into a web form. The API
 * accepts a replacement table for the rare case where it's needed; the UI shows it read-only.
 */

interface Props {
  settings: FinanceSettings;
  onSaved: (s: FinanceSettings) => void;
  stripeConfigured: boolean;
  stripeRestricted: boolean;
}

export default function SettingsTab({
  settings,
  onSaved,
  stripeConfigured,
  stripeRestricted,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  async function save(patch: Partial<FinanceSettings>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/finances/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not save.');
      onSaved(json.settings as FinanceSettings);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm('Restore the verified TY2026 defaults? Your edits will be replaced.')) {
      return;
    }
    await save({ action: 'reset' } as unknown as Partial<FinanceSettings>);
  }

  return (
    <div className="space-y-10">
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {saved && <p className="text-xs text-ok">Saved.</p>}

      <section>
        <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl">Tax constants</h2>
          <span className="badge badge-accent">Tax year {settings.taxYear}</span>
        </div>
        <p className="mb-5 max-w-2xl text-xs leading-relaxed text-fg3">
          Shipped values were verified against <strong>IRS Rev. Proc. 2025-32</strong> (standard
          deduction §4.14, rate tables §4.01 Table 3, QBI §4.26 and §2.12) and the{' '}
          <strong>SSA 2026 COLA fact sheet</strong> (wage base, Additional Medicare).{' '}
          <strong>Review these every year</strong> — all of them are inflation-adjusted annually.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <MoneyField
            label="Standard deduction"
            hint="Single filer. Rev. Proc. 2025-32 §4.14(1)."
            cents={settings.standardDeductionCents}
            disabled={busy}
            onSave={(v) => save({ standardDeductionCents: v })}
          />
          <MoneyField
            label="Social Security wage base"
            hint="Social Security stops above this; Medicare never does."
            cents={settings.ssWageBaseCents}
            disabled={busy}
            onSave={(v) => save({ ssWageBaseCents: v })}
          />
          <MoneyField
            label="QBI threshold"
            hint="Above this, §199A limits phase in by business type and W-2 wages."
            cents={settings.qbiThresholdCents}
            disabled={busy}
            onSave={(v) => save({ qbiThresholdCents: v })}
          />
          <MoneyField
            label="Additional Medicare threshold"
            hint="0.9% surcharge applies above this."
            cents={settings.additionalMedicareThresholdCents}
            disabled={busy}
            onSave={(v) => save({ additionalMedicareThresholdCents: v })}
          />
          <MoneyField
            label="QBI minimum deduction"
            hint="OBBBA §70105. Applies once you clear the eligibility floor."
            cents={settings.qbiMinimumCents}
            disabled={busy}
            onSave={(v) => save({ qbiMinimumCents: v })}
          />
          <MoneyField
            label="QBI eligibility floor"
            hint="Below this much QBI there is no deduction at all — not even the minimum."
            cents={settings.qbiEligibilityFloorCents}
            disabled={busy}
            onSave={(v) => save({ qbiEligibilityFloorCents: v })}
          />
        </div>

        <h3 className="mb-3 mt-8 text-sm font-medium">Rates</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <RateField
            label="SE taxable share of net"
            hint="92.35% — the statutory stand-in for an employer's half."
            rate={settings.seBaseMultiplier}
            disabled={busy}
            onSave={(v) => save({ seBaseMultiplier: v })}
          />
          <RateField
            label="Social Security rate"
            hint="12.4%, both halves, capped at the wage base."
            rate={settings.seSocialSecurityRate}
            disabled={busy}
            onSave={(v) => save({ seSocialSecurityRate: v })}
          />
          <RateField
            label="Medicare rate"
            hint="2.9%, uncapped."
            rate={settings.seMedicareRate}
            disabled={busy}
            onSave={(v) => save({ seMedicareRate: v })}
          />
          <RateField
            label="Additional Medicare rate"
            hint="0.9% above the threshold."
            rate={settings.additionalMedicareRate}
            disabled={busy}
            onSave={(v) => save({ additionalMedicareRate: v })}
          />
          <RateField
            label="QBI rate"
            hint="20% under §199A."
            rate={settings.qbiRate}
            disabled={busy}
            onSave={(v) => save({ qbiRate: v })}
          />
          <RateField
            label="State income tax rate"
            hint="Florida has none. Only change this if you move."
            rate={settings.stateIncomeTaxRate}
            disabled={busy}
            onSave={(v) => save({ stateIncomeTaxRate: v })}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl">Federal brackets</h2>
        <p className="mb-4 max-w-2xl text-xs text-fg3">
          Rev. Proc. 2025-32 §4.01, Table 3 — unmarried individuals. Shown read-only: seven rows
          of interdependent figures where a typo produces a confidently wrong number rather than
          an error, and the annual update is better done in code where it can be reviewed.
        </p>
        <table className="w-full max-w-lg border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule text-left">
              <th className="px-2 py-1.5 text-meta uppercase tracking-wide text-fg3">Over</th>
              <th className="px-2 py-1.5 text-meta uppercase tracking-wide text-fg3">Base</th>
              <th className="px-2 py-1.5 text-right text-meta uppercase tracking-wide text-fg3">
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {settings.brackets.map((b) => (
              <tr key={b.overCents} className="border-b border-rule last:border-0">
                <td className="px-2 py-1.5 text-xs tabular-nums">{money(b.overCents)}</td>
                <td className="px-2 py-1.5 text-xs tabular-nums">{money(b.baseCents)}</td>
                <td className="px-2 py-1.5 text-right text-xs tabular-nums">
                  {(b.rate * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-1 text-xl">Expense categories</h2>
        <p className="mb-4 text-xs text-fg3">
          Removing one that&rsquo;s in use leaves those rows tagged with it — they stay visible
          and keep counting toward your totals.
        </p>
        <ul className="mb-3 flex flex-wrap gap-2">
          {settings.categories.map((c) => (
            <li
              key={c}
              className="flex items-center gap-1.5 rounded border border-rule px-2 py-1 text-xs"
            >
              {c}
              <button
                type="button"
                disabled={busy || settings.categories.length <= 1}
                onClick={() =>
                  save({ categories: settings.categories.filter((x) => x !== c) })
                }
                className="text-fg3 hover:text-danger disabled:opacity-30"
                aria-label={`Remove ${c}`}
                title={
                  settings.categories.length <= 1 ? 'Keep at least one' : `Remove ${c}`
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCategory.trim()) {
                void save({ categories: [...settings.categories, newCategory.trim()] });
                setNewCategory('');
              }
            }}
            placeholder="new category"
            className="input h-8 w-48 px-2 text-xs"
          />
          <button
            type="button"
            disabled={busy || !newCategory.trim()}
            onClick={() => {
              void save({ categories: [...settings.categories, newCategory.trim()] });
              setNewCategory('');
            }}
            className="btn btn-sm disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl">Stripe</h2>
        <p className="text-xs text-fg2">
          {!stripeConfigured ? (
            <>
              No Stripe key configured. Set <code className="codechip">STRIPE_READONLY_KEY</code>{' '}
              in <code className="codechip">jdd-ops/.env</code>.
            </>
          ) : stripeRestricted ? (
            <>
              Using a <strong>restricted read-only key</strong> — the right posture for a console
              with no login. It needs the{' '}
              <code className="codechip">balance_transaction:read</code> permission to total your
              income.
            </>
          ) : (
            <>
              Using a <strong>full secret key</strong>. Consider switching to a restricted
              read-only key (<code className="codechip">STRIPE_READONLY_KEY</code>) — this console
              has no authentication, and nothing here ever needs to write to Stripe.
            </>
          )}
        </p>
      </section>

      <section className="border-t border-rule pt-6">
        <button type="button" onClick={reset} disabled={busy} className="btn btn-sm">
          Restore TY2026 defaults
        </button>
      </section>
    </div>
  );
}

/* ── Fields ─────────────────────────────────────────────────────────────────────────────── */

function MoneyField({
  label,
  hint,
  cents,
  disabled,
  onSave,
}: {
  label: string;
  hint: string;
  cents: number;
  disabled: boolean;
  onSave: (cents: number) => void;
}) {
  return (
    <div>
      <label className="field-label block">{label}</label>
      <input
        key={cents}
        defaultValue={(cents / 100).toFixed(2)}
        inputMode="decimal"
        disabled={disabled}
        onBlur={(e) => {
          // Zero is a legitimate setting here, so this parses leniently and only rejects
          // genuinely unusable input rather than reusing the ledger's "must be > 0" rule.
          const raw = e.target.value.replace(/[$,\s]/g, '');
          const n = Number(raw);
          if (!raw || !Number.isFinite(n) || n < 0) {
            e.target.value = (cents / 100).toFixed(2);
            return;
          }
          const next = Math.round(n * 100);
          if (next !== cents) onSave(next);
        }}
        className="input mt-1 h-9 w-full px-2 text-sm tabular-nums"
      />
      <p className="meta mt-1 text-fg3">{hint}</p>
    </div>
  );
}

function RateField({
  label,
  hint,
  rate,
  disabled,
  onSave,
}: {
  label: string;
  hint: string;
  rate: number;
  disabled: boolean;
  onSave: (rate: number) => void;
}) {
  return (
    <div>
      <label className="field-label block">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          key={rate}
          defaultValue={(rate * 100).toFixed(2)}
          inputMode="decimal"
          disabled={disabled}
          onBlur={(e) => {
            // Entered as a percentage and stored as a fraction — typing 12.4 for 12.4% is the
            // natural thing to do, and the API rejects anything above 1 precisely because that
            // mistake is otherwise invisible.
            const n = Number(e.target.value.replace(/[%\s]/g, ''));
            if (!Number.isFinite(n) || n < 0 || n > 100) {
              e.target.value = (rate * 100).toFixed(2);
              return;
            }
            const next = Number((n / 100).toFixed(6));
            if (next !== rate) onSave(next);
          }}
          className="input h-9 w-full px-2 text-sm tabular-nums"
        />
        <span className="text-sm text-fg3">%</span>
      </div>
      <p className="meta mt-1 text-fg3">{hint}</p>
    </div>
  );
}
