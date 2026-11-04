'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CaretDown, SpinnerGap, Warning } from '@phosphor-icons/react';
import PlanChip from '@/components/PlanChip';
import PlanDowngradePanel from './PlanDowngradePanel';
import { useManage } from './ManageContext';
import type { ClientContext } from '@/lib/types';

/**
 * The plan pill on Overview, made editable.
 *
 * Only starter ↔ growth is offered. onboard.js enforces `enterprise` ⟺ 2–3 sites, so
 * moving into or out of enterprise means adding or removing whole client sites — a
 * provisioning job, not a field edit. Enterprise clients (and any client whose site.ts
 * couldn't be read) get the plain display chip with no affordance, rather than a disabled
 * control implying the operation exists somewhere.
 *
 * The two directions are asymmetric on purpose (contract v5.3 §15.4). An upgrade takes effect
 * now, so it confirms inline and moves billing in the same action. A downgrade takes effect at
 * the end of the client's paid period and needs them to accept the Starter terms, so it goes
 * through PlanDowngradePanel: request it, then switch env and site.ts once it has landed.
 * Neither direction destroys anything; Starter runs the same voice stack as Growth.
 */

interface UpgradeResponse {
  ok?: boolean;
  error?: string;
  missing?: string[];
  note?: string;
}

export default function PlanControl({ ctx, onChanged }: { ctx: ClientContext; onChanged: () => void }) {
  const { confirmWrite } = useManage();
  const editable = ctx.hasIntake && !ctx.isEnterprise && ctx.plan !== 'enterprise' && ctx.sites.length === 1;
  const target = ctx.plan === 'starter' ? 'growth' : 'starter';

  const [open, setOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!editable) {
    return <PlanChip plan={ctx.plan} />;
  }

  async function runUpgrade() {
    if (
      !(await confirmWrite({
        title: 'Upgrade plan to growth',
        effect: `Changes ${ctx.slug} to the growth plan: turns the web-form callback on, updates the live portal account, and moves Stripe billing to Growth now (prorated, through the portal app). This moves real money.`,
      }))
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/manage/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, targetPlan: 'growth' }),
      });
      const body = (await res.json()) as UpgradeResponse;
      if (!body.ok) {
        setError(body.error ?? 'Upgrade failed.');
        return;
      }
      setUpgrading(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upgrade failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrap} className="relative inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded transition-opacity hover:opacity-80"
        title="Change plan tier"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <PlanChip plan={ctx.plan} />
        <CaretDown size={10} className="text-fg3" />
      </button>

      {open && (
        <div
          role="menu"
          className="panel absolute left-0 top-[calc(100%+6px)] z-50 w-[220px] p-1"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full flex-col gap-0.5 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface)]"
            onClick={() => {
              setOpen(false);
              setError(null);
              if (target === 'growth') setUpgrading(true);
              else setDowngrading(true);
            }}
          >
            <span className="text-xs text-fg">Switch to {target}</span>
            <span className="text-2xs text-fg3">
              {target === 'growth'
                ? 'Turns the callback on; bills Growth now'
                : 'Client accepts Starter terms; takes effect at period end'}
            </span>
          </button>
        </div>
      )}

      {error && (
        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--danger)' }}>
          <Warning size={12} weight="fill" /> {error}
        </span>
      )}

      {/* ── Upgrade confirm ────────────────────────────────────────────────── */}
      {upgrading && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ background: 'rgba(4,8,18,0.86)', backdropFilter: 'blur(8px)' }}
          onClick={() => !busy && setUpgrading(false)}
        >
          <div className="panel w-full max-w-[520px] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-display text-lg font-medium">Upgrade {ctx.brandName} to growth?</h3>
            <p className="mb-3 text-xs leading-[1.6] text-fg2">
              This changes the plan in site.ts and sets{' '}
              <code className="codechip">LEAD_DELIVERY_MODE=callback</code>, then syncs and
              redeploys.
            </p>
            <p className="mb-3 text-xs leading-[1.6]" style={{ color: 'var(--warn)' }}>
              It does <strong>not</strong> provision anything. The Retell agent, Twilio number, and
              Airtable base are real purchases that onboard.js owns — until you re-run onboarding
              for this client, the live site&apos;s contact form will have nothing to call and lead
              capture will fail.
            </p>
            <p className="mb-3 text-xs leading-[1.6]" style={{ color: 'var(--warn)' }}>
              What the <strong>client</strong> sees straight away: the Call Log tab unlocks, but
              reads &ldquo;Setting up&rdquo; with no data, and the Receptionist line on their
              Overview says the same — because the portal gates that on the Airtable base, which
              only onboard.js creates.
            </p>
            <p className="mb-4 text-xs leading-[1.6]" style={{ color: 'var(--warn)' }}>
              And it does <strong>not</strong> change what Stripe charges. They will use growth on a
              starter invoice until you sync billing under <strong>Portal → Billing vs plan</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setUpgrading(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void runUpgrade()}>
                {busy ? <SpinnerGap size={13} className="animate-spin" /> : null}
                {busy ? 'Switching…' : 'Switch to growth'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Downgrade ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {downgrading && (
          <PlanDowngradePanel
            slug={ctx.slug}
            onClose={() => setDowngrading(false)}
            onDone={onChanged}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
