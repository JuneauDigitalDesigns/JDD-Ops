'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowsClockwise, CheckCircle, CurrencyDollar, Warning, XCircle } from '@phosphor-icons/react';

/**
 * Does Stripe agree with the plan on the portal record?
 *
 * The plan controls in this console change `plan` in KV and never touch Stripe. That gap is
 * invisible and expensive in one direction: a client moved to Growth keeps paying Starter
 * while using the receptionist, the call log and everything else, and nothing in either
 * system notices. This panel is where that becomes visible.
 *
 * Both the diagnosis and the repair are answered by the portal app. Nothing here talks to
 * Stripe, and nothing here knows what a plan costs — see the route comment for why.
 */

interface BillingState {
  ok?: boolean;
  error?: string;
  recordPlan?: string;
  subscriptionId?: string | null;
  subscriptionStatus?: string | null;
  currentAmount?: number | null;
  currentInterval?: string | null;
  matches?: boolean;
  portalBaseUrl?: string;
}

export default function BillingSyncPanel({
  clientSlug,
  siteSlug,
  email,
}: {
  clientSlug: string;
  siteSlug: string;
  email: string;
}) {
  const [state, setState] = useState<BillingState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/manage/plan/billing?email=${encodeURIComponent(email)}&slug=${encodeURIComponent(siteSlug)}`,
        { cache: 'no-store' },
      );
      setState((await res.json()) as BillingState);
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : 'Billing check failed.' });
    }
  }, [email, siteSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    if (!state?.recordPlan) return;
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch('/api/manage/plan/billing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: clientSlug, siteSlug, email, plan: state.recordPlan }),
      });
      const body = (await res.json()) as { ok?: boolean; changed?: boolean; error?: string };
      setResult(
        body.ok
          ? body.changed
            ? 'Stripe updated. The client is billed the difference on this invoice.'
            : 'Already correct in Stripe — nothing charged.'
          : (body.error ?? 'Sync failed.'),
      );
      if (body.ok) await load();
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  const money = (cents?: number | null, interval?: string | null) =>
    typeof cents === 'number' ? `$${(cents / 100).toFixed(2)}${interval ? `/${interval}` : ''}` : '—';

  const drifted = state?.ok === true && state.matches === false;

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-rule p-4">
      <div className="flex items-center gap-2">
        <CurrencyDollar size={15} weight="fill" style={{ color: 'var(--accent)' }} />
        <h3 className="font-display text-sm font-semibold text-fg">Billing</h3>
        <button
          type="button"
          onClick={load}
          className="ml-auto text-xs text-fg3 underline underline-offset-2"
        >
          Recheck
        </button>
      </div>

      {state === null && <p className="text-xs text-fg3">Checking Stripe…</p>}

      {state?.error && (
        <span className="flex items-start gap-2 text-xs" style={{ color: 'var(--danger)' }}>
          <Warning size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {state.error}
        </span>
      )}

      {state?.ok && (
        <>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-baseline gap-3">
              <span className="w-[110px] shrink-0 text-fg3">Portal record</span>
              <span className="text-fg">{state.recordPlan}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="w-[110px] shrink-0 text-fg3">Stripe</span>
              <span className="text-fg">
                {state.subscriptionId
                  ? `${money(state.currentAmount, state.currentInterval)} · ${state.subscriptionStatus}`
                  : 'no subscription found'}
              </span>
            </div>
          </div>

          {drifted ? (
            <div
              className="flex flex-col gap-2 rounded-[8px] p-3"
              style={{ background: 'var(--bg-deep)' }}
            >
              <span className="flex items-start gap-2 text-xs" style={{ color: 'var(--warn)' }}>
                <Warning size={14} weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
                {state.subscriptionId
                  ? `They are using ${state.recordPlan} and paying ${money(state.currentAmount, state.currentInterval)}.`
                  : 'No Stripe subscription is linked, so nothing is being billed for this site.'}
              </span>
              {state.subscriptionId && (
                <button
                  type="button"
                  onClick={sync}
                  disabled={syncing}
                  className="btn btn-primary btn-sm self-start"
                >
                  <ArrowsClockwise size={13} weight="fill" />
                  {syncing ? 'Syncing…' : `Sync billing to ${state.recordPlan}`}
                </button>
              )}
              <span className="text-xs text-fg3">
                Charges the prorated difference immediately. No client signature is involved —
                this corrects billing to a plan already set here.
              </span>
            </div>
          ) : (
            <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--ok)' }}>
              <CheckCircle size={14} weight="fill" /> Stripe matches the plan on record.
            </span>
          )}
        </>
      )}

      {result && (
        <span className="flex items-start gap-2 text-xs text-fg2">
          {result.toLowerCase().includes('fail') ? (
            <XCircle size={14} weight="fill" style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
          ) : (
            <CheckCircle size={14} weight="fill" style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 1 }} />
          )}
          {result}
        </span>
      )}
    </div>
  );
}
