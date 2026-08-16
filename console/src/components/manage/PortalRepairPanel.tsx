'use client';

import { useState } from 'react';
import { ArrowsClockwise, CheckCircle, Flask, MagnifyingGlass, Play, XCircle } from '@phosphor-icons/react';

/**
 * Per-field repair for one site on a portal account.
 *
 * The gap this fills: when a live site is missing an id the portal needs, the client sees a
 * tab stuck on "we're finishing your setup" and nothing in the product could fix it. The
 * Attach panel above can't — it rebuilds entries from the client's disk state, which by
 * design cannot express `vercelProjectId` and never touches Stripe. Until now the only cure
 * was a CLI script, which is the wrong place for the thing you reach for when a client is
 * broken.
 *
 * **Blank and Clear are different, deliberately.** Leaving a box untouched preserves what's
 * stored; pressing Clear writes an explicit null. Collapsing those two is exactly what once
 * overwrote a good Airtable base id with null and silently killed a client's Call Log, so
 * the UI refuses to guess: an emptied box is rejected by the API rather than interpreted.
 */

export interface RepairSite {
  slug: string;
  name: string | null;
  plan: string;
  status: string;
  canonical: string | null;
  airtableBaseId: string | null;
  vercelProjectId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  hasCheckoutSession: boolean;
  features: Record<string, { state: string }>;
  mine: boolean;
}

/** Text fields, in the order they matter when something is broken. */
const TEXT_FIELDS = [
  { key: 'airtableBaseId', label: 'Airtable base', hint: 'Powers the Call Log tab.' },
  { key: 'vercelProjectId', label: 'Vercel project', hint: 'Powers the Traffic tab.' },
  { key: 'canonical', label: 'Canonical URL', hint: 'Powers the Performance score.' },
  { key: 'stripeSubscriptionId', label: 'Stripe subscription', hint: 'Powers the Billing tab.' },
  { key: 'stripeCustomerId', label: 'Stripe customer', hint: 'Fallback for resolving billing.' },
] as const;

type TextField = (typeof TEXT_FIELDS)[number]['key'];

const PLANS = ['starter', 'growth', 'enterprise'];
const STATUSES = ['pending-onboarding', 'building', 'live'];

interface Change {
  field: string;
  from: unknown;
  to: unknown;
}

interface RepairResult {
  ok?: boolean;
  dryRun?: boolean;
  written?: boolean;
  changes?: Change[];
  effective?: string[];
  error?: string;
}

interface StripeSub {
  id: string;
  status: string;
  nickname: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  currentPeriodEnd: number;
}

export default function PortalRepairPanel({
  clientSlug,
  email,
  site,
  onWritten,
}: {
  clientSlug: string;
  email: string;
  site: RepairSite;
  onWritten: () => void | Promise<void>;
}) {
  // `undefined` = untouched (preserve). `null` = cleared. string = set.
  const [edits, setEdits] = useState<Partial<Record<TextField | 'plan' | 'status', string | null>>>({});
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [subs, setSubs] = useState<StripeSub[] | null>(null);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const dirty = Object.keys(edits).length > 0;

  function setField(key: TextField | 'plan' | 'status', value: string | null | undefined) {
    setEdits((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
    setResult(null);
  }

  async function findInStripe() {
    setLookingUp(true);
    setSubs(null);
    setSubsError(null);
    try {
      const res = await fetch(`/api/manage/stripe-lookup?email=${encodeURIComponent(email)}`, {
        cache: 'no-store',
      });
      const body = (await res.json()) as {
        error?: string;
        customers?: Array<{ customerId: string; subscriptions: StripeSub[] }>;
      };
      if (body.error) {
        setSubsError(body.error);
        return;
      }
      const flat = (body.customers ?? []).flatMap((c) =>
        c.subscriptions.map((s) => ({ ...s, customerId: c.customerId })),
      );
      setSubs(flat);
      if (flat.length === 0) setSubsError(`No Stripe subscriptions found for ${email}.`);
    } catch (err) {
      setSubsError(err instanceof Error ? err.message : 'Stripe lookup failed.');
    } finally {
      setLookingUp(false);
    }
  }

  async function submit() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/manage/repair-portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: clientSlug, siteSlug: site.slug, email, fields: edits, dryRun }),
      });
      const body = (await res.json()) as RepairResult;
      setResult(body);
      if (body.ok && body.written) {
        setEdits({});
        await onWritten();
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Repair failed.' });
    } finally {
      setRunning(false);
    }
  }

  const drifting = Object.entries(site.features)
    .filter(([, v]) => v.state === 'connecting')
    .map(([k]) => k);

  return (
    <div className="flex flex-col gap-3 border-t border-rule pt-4 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-fg">{site.slug}</span>
        <span className="meta text-fg3">
          {site.plan} / {site.status}
        </span>
        {drifting.length > 0 && (
          <span className="meta" style={{ color: 'var(--warn)' }}>
            drift: {drifting.join(', ')}
          </span>
        )}
      </div>

      {/* The portal's own verdict, so this panel and the client's dashboard can't disagree. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(site.features).map(([name, v]) => (
          <span key={name} className="meta text-fg3">
            {name}=
            <span
              style={{
                color:
                  v.state === 'ready'
                    ? 'var(--ok)'
                    : v.state === 'connecting'
                      ? 'var(--warn)'
                      : 'var(--fg-3)',
              }}
            >
              {v.state}
            </span>
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {TEXT_FIELDS.map((f) => {
          const stored = site[f.key];
          const edit = edits[f.key];
          const cleared = edit === null;
          return (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="field-label !mb-0 flex items-center gap-2">
                {f.label}
                <span className="meta font-normal text-fg3">{f.hint}</span>
              </span>
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1 font-mono text-xs"
                  value={cleared ? '' : (edit ?? stored ?? '')}
                  placeholder={stored ? undefined : 'not set'}
                  disabled={cleared || running}
                  spellCheck={false}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Reverting to the stored value means "untouched", not "set to same".
                    setField(f.key, v === (stored ?? '') ? undefined : v);
                  }}
                />
                {f.key === 'stripeSubscriptionId' && (
                  <button
                    type="button"
                    className="btn btn-xs"
                    onClick={findInStripe}
                    disabled={lookingUp || running}
                    title="Look this up in Stripe by the account email"
                  >
                    <MagnifyingGlass size={12} weight="bold" />
                    {lookingUp ? '…' : 'Find'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-xs"
                  disabled={running || (stored === null && !cleared)}
                  onClick={() => setField(f.key, cleared ? undefined : null)}
                  title={
                    cleared
                      ? 'Keep the stored value'
                      : 'Write an explicit "none" — different from leaving this blank'
                  }
                  style={cleared ? { borderColor: 'var(--danger)', color: 'var(--danger)' } : undefined}
                >
                  {cleared ? 'Undo' : 'Clear'}
                </button>
              </div>
            </label>
          );
        })}

        {subsError && (
          <span className="text-xs" style={{ color: 'var(--danger)' }}>
            {subsError}
          </span>
        )}
        {subs && subs.length > 0 && (
          <div className="flex flex-col gap-1 rounded-[10px] border border-rule p-2.5">
            <span className="kicker">Stripe subscriptions for {email}</span>
            {subs.map((s) => (
              <button
                key={s.id}
                type="button"
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-[var(--bg-deep)]"
                onClick={() => setField('stripeSubscriptionId', s.id)}
              >
                <span className="font-mono text-fg">{s.id}</span>
                <span className="text-fg3">{s.status}</span>
                {s.amount !== null && (
                  <span className="text-fg3">
                    {(s.amount / 100).toFixed(2)} {(s.currency ?? '').toUpperCase()}
                    {s.interval ? `/${s.interval}` : ''}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="field-label !mb-0">Plan</span>
            <select
              className="input text-xs"
              value={edits.plan ?? site.plan}
              disabled={running}
              onChange={(e) => setField('plan', e.target.value === site.plan ? undefined : e.target.value)}
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="field-label !mb-0">Status</span>
            <select
              className="input text-xs"
              value={edits.status ?? site.status}
              disabled={running}
              onChange={(e) => setField('status', e.target.value === site.status ? undefined : e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setDryRun((d) => !d)}
          disabled={running}
          className="flex items-center gap-2 text-xs"
        >
          <span
            className="relative h-[18px] w-[32px] rounded-full transition-colors"
            style={{ background: dryRun ? 'var(--ok)' : 'var(--rule-strong)' }}
          >
            <span
              className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all"
              style={{ left: dryRun ? '16px' : '2px' }}
            />
          </span>
          <span className="meta" style={{ color: dryRun ? 'var(--ok)' : 'var(--fg-3)' }}>
            <Flask size={12} weight="fill" style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
            Dry run {dryRun ? 'on' : 'off'}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {dirty && (
            <button type="button" className="btn btn-xs" onClick={() => setEdits({})} disabled={running}>
              <ArrowsClockwise size={12} weight="bold" />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!dirty || running}
            className={dryRun ? 'btn btn-sm' : 'btn btn-primary btn-sm'}
          >
            <Play size={13} weight="fill" />
            {running ? 'Working…' : dryRun ? 'Preview (dry run)' : 'Write to account'}
          </button>
        </div>
      </div>

      {result && (
        <div
          className="flex flex-col gap-2 rounded-[10px] border border-rule p-3"
          style={{ background: 'var(--bg-deep)' }}
        >
          {result.error && (
            <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
              <XCircle size={14} weight="fill" /> {result.error}
            </span>
          )}
          {result.ok &&
            result.changes?.map((c) => {
              const moved = c.from !== c.to;
              return (
                <div key={c.field} className="flex items-start gap-2 text-xs">
                  {moved ? (
                    <CheckCircle
                      size={14}
                      weight="fill"
                      style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }}
                    />
                  ) : (
                    <span className="mt-[2px] w-[14px] shrink-0" />
                  )}
                  <span className="min-w-0 break-all text-fg2">
                    <span className="text-fg3">{c.field}: </span>
                    <span className="font-mono">{fmt(c.from)}</span>
                    <span className="text-fg3"> → </span>
                    <span className="font-mono">{fmt(c.to)}</span>
                    {!moved && <span className="text-fg3"> (unchanged)</span>}
                  </span>
                </div>
              );
            })}
          {result.ok && result.dryRun && (
            <span className="text-xs text-fg3">Dry run — nothing written. Flip the toggle off to apply.</span>
          )}
          {result.ok && result.written && (
            <span className="text-xs text-fg3">
              Written. Have the client reload their portal to see it.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return 'none';
  return String(v);
}
