'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  closeHasSmsStep,
  isOrderPaid,
  type CloseStep,
  type OperatorOrder,
  type ReadinessLight,
} from '@jdd/schema';
import type { A2pEnums } from '@/lib/a2pChain';
import { A2pRegistrationPanel } from '@/components/manage/MessagingSection';
import { slugify } from '@/lib/slugify';
import { checkSiteId } from '@/lib/siteId';
import ReadinessStrip from './ReadinessStrip';

/**
 * Close a lead on a sales call. The approved mockup is the spec:
 * https://claude.ai/artifact/BVZRCi4j7MF1tfAZZzsMps (copy deck: PLAN-sales-call-close.md §9).
 *
 * Written for a screen share: the client watches this, so it carries labels and short
 * instructions only. Nothing here takes a card number (Stripe's page does), and nothing writes
 * an order, Stripe or Clerk directly — every action goes through `/api/sales/*` to the agency.
 */

type Plan = 'starter' | 'growth';
type Period = 'monthly' | 'annual';
type Mode = 'forwarded' | 'published' | 'declined';

interface LeadInfo {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  email: string;
  planInterest: 'starter' | 'growth' | 'enterprise' | null;
  trade: string | null;
}

interface Prices {
  [plan: string]: { name: string; monthly: number; annual: number; onboardingFee: number };
}

interface TermsView {
  script: { version: string; hash: string; lines: string[] };
  termsHash: string;
  totals: { today: number; recurring: number; period: Period };
}

const STEP_LABELS: Record<CloseStep, string> = {
  order: 'Order',
  terms: 'Terms',
  payment: 'Payment',
  setup: 'Setup',
  sms: 'SMS registration',
  done: 'Done',
};

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

async function post<T = Record<string, unknown>>(url: string, body: unknown = {}): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, data };
}

export default function CloseWizard({
  lead,
  initialOrder,
  initialStep,
  verticals,
  a2pEnums,
}: {
  lead: LeadInfo;
  initialOrder: OperatorOrder | null;
  initialStep: CloseStep;
  verticals: { id: string; label: string }[];
  a2pEnums: A2pEnums | null;
}) {
  const [order, setOrder] = useState<OperatorOrder | null>(initialOrder);
  const [step, setStep] = useState<CloseStep>(initialStep);
  const [terms, setTerms] = useState<TermsView | null>(null);
  const [prices, setPrices] = useState<Prices | null>(null);

  useEffect(() => {
    fetch('/api/sales/prices', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => d.prices && setPrices(d.prices))
      .catch(() => {});
  }, []);

  // Resuming at Terms or later needs the script back; the agency's GET carries it.
  useEffect(() => {
    if (!order || terms) return;
    fetch(`/api/sales/orders/${order.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d.script) setTerms({ script: d.script, termsHash: d.termsHash, totals: d.totals });
        if (d.order) setOrder(d.order);
      })
      .catch(() => {});
  }, [order, terms]);

  const plan: Plan = (order?.plan as Plan) ?? 'growth';
  const steps = useMemo<CloseStep[]>(
    () => ['order', 'terms', 'payment', 'setup', ...(closeHasSmsStep(plan) ? (['sms'] as CloseStep[]) : []), 'done'],
    [plan],
  );

  const title = order ? order.client.dba || order.client.legalName : lead.businessName;
  const contact = order ? `${order.client.contactName} · ${order.client.phone}` : `${lead.name} · ${lead.phone}`;

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[980px] flex-col gap-5 px-7 py-6">
        <div className="flex flex-col gap-1">
          <Link href="/leads" className="text-sm text-fg2 hover:text-fg">← Leads</Link>
          <h1 className="font-display text-4xl font-bold leading-none text-fg">{title}</h1>
          <div className="text-fg2">{contact}</div>
        </div>

        <Stepper steps={steps} current={step} />

        {step === 'order' && (
          <OrderStep
            lead={lead}
            order={order}
            prices={prices}
            verticals={verticals}
            onSaved={(o, t) => {
              setOrder(o);
              setTerms(t);
              setStep('terms');
            }}
          />
        )}
        {step === 'terms' && order && terms && (
          <TermsStep order={order} terms={terms} onAccepted={(o) => setOrder(o)} onContinue={() => setStep('payment')} />
        )}
        {step === 'payment' && order && (
          <PaymentStep
            order={order}
            totals={terms?.totals ?? null}
            onOrder={setOrder}
            onPaid={(o) => {
              setOrder(o);
              setStep('setup');
            }}
            onCancelled={() => {
              setOrder(null);
              setTerms(null);
              setStep('order');
            }}
          />
        )}
        {step === 'setup' && order && (
          <SetupStep
            order={order}
            onOrder={setOrder}
            onContinue={() => setStep(closeHasSmsStep(order.plan) ? 'sms' : 'done')}
          />
        )}
        {step === 'sms' && order && (
          <SmsStep order={order} enums={a2pEnums} onContinue={() => setStep('done')} />
        )}
        {step === 'done' && order && <DoneStep order={order} />}
      </div>
    </div>
  );
}

// ── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ steps, current }: { steps: CloseStep[]; current: CloseStep }) {
  const at = steps.indexOf(current);
  return (
    <ol aria-label="Steps" className="flex flex-wrap gap-1.5">
      {steps.map((s, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <li
            key={s}
            aria-current={now ? 'step' : undefined}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border py-0 pl-1.5 pr-3.5 text-[13px] font-semibold ${
              now ? 'border-fg bg-fg text-bg' : done ? 'border-[var(--rule)] text-fg' : 'border-[var(--rule)] text-fg3'
            }`}
          >
            <span
              className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs"
              style={{
                background: now ? 'var(--accent-2)' : done ? 'var(--accent)' : 'var(--surface-2)',
                color: now || done ? 'var(--bg)' : 'var(--fg-2)',
              }}
            >
              {done ? '✓' : i + 1}
            </span>
            {STEP_LABELS[s]}
          </li>
        );
      })}
    </ol>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <section className="panel flex flex-col gap-5 p-6">{children}</section>;
}

function Chip({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`flex min-w-[110px] flex-col items-start gap-0.5 rounded-[10px] px-3.5 py-2.5 text-left text-sm text-fg disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? 'border-2 border-[var(--accent)] bg-[rgba(31,111,120,0.10)]' : 'm-px border border-[var(--rule-strong)] bg-[var(--panel)]'
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="field-label">{label}</span>
      {children}
      {hint}
    </label>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div role="alert" className="rounded-[10px] border px-3.5 py-2.5 text-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
      {text}
    </div>
  );
}

interface ChecklistItem {
  text: string;
  sub: string;
  state: 'done' | 'now' | 'todo' | 'warn' | 'failed';
}

function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((c) => (
        <li
          key={c.text}
          className={`flex items-start gap-3 rounded-[10px] border bg-[var(--panel)] px-3.5 py-3 ${c.state === 'todo' ? 'opacity-50' : ''}`}
          style={{ borderColor: c.state === 'warn' ? 'var(--warn)' : 'var(--rule)' }}
        >
          <span
            className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold"
            style={
              c.state === 'done'
                ? { background: 'var(--ok)', color: '#fff' }
                : c.state === 'warn'
                  ? { background: 'var(--warn)', color: '#fff' }
                  : c.state === 'failed'
                    ? { background: 'var(--danger)', color: '#fff' }
                    : c.state === 'now'
                      ? { background: 'rgba(31,111,120,0.18)', color: 'var(--accent)' }
                      : { border: '1px solid var(--rule-strong)' }
            }
          >
            {c.state === 'done' ? '✓' : c.state === 'warn' || c.state === 'failed' ? '!' : c.state === 'now' ? '•' : ''}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold text-fg">{c.text}</span>
            <span className="text-[13px] text-fg2">{c.sub}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Reveal results one at a time, 650ms apart — the animation the mockup was approved with. */
function useReveal(total: number, start: boolean): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!start || shown >= total) return;
    const t = setTimeout(() => setShown((n) => n + 1), 650);
    return () => clearTimeout(t);
  }, [start, shown, total]);
  return shown;
}

// ── Order ───────────────────────────────────────────────────────────────────

const ENTITY_TYPES = ['LLC', 'Corporation', 'Sole proprietorship', 'Partnership'];

function OrderStep({
  lead,
  order,
  prices,
  verticals,
  onSaved,
}: {
  lead: LeadInfo;
  order: OperatorOrder | null;
  prices: Prices | null;
  verticals: { id: string; label: string }[];
  onSaved: (order: OperatorOrder, terms: TermsView) => void;
}) {
  const c = order?.client;
  const [plan, setPlan] = useState<Plan>((order?.plan as Plan) ?? (lead.planInterest === 'starter' ? 'starter' : 'growth'));
  const [period, setPeriod] = useState<Period>(order?.period ?? 'monthly');
  const [legalName, setLegalName] = useState(c?.legalName ?? lead.businessName);
  const [dba, setDba] = useState(c?.dba ?? lead.businessName);
  const [entityType, setEntityType] = useState(c?.entityType ?? 'LLC');
  const [address, setAddress] = useState(c?.address ?? '');
  const [vertical, setVertical] = useState(
    order?.vertical ?? verticals.find((v) => v.id === lead.trade || v.label.toLowerCase() === (lead.trade ?? '').toLowerCase())?.id ?? verticals[0]?.id ?? '',
  );
  const [contactName, setContactName] = useState(c?.contactName ?? lead.name);
  const [contactTitle, setContactTitle] = useState(c?.contactTitle ?? 'Owner');
  const [email, setEmail] = useState(c?.email ?? lead.email);
  const [phone, setPhone] = useState(c?.phone ?? lead.phone);
  const [siteSlug, setSiteSlug] = useState(order?.siteSlug ?? slugify(lead.businessName));
  const [mode, setMode] = useState<Mode>((order?.receptionistMode as Mode) ?? 'forwarded');
  const [forwardingNumber, setForwardingNumber] = useState(order?.forwardingNumber ?? '');
  const [slugState, setSlugState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A Site ID already claimed by THIS order is available by definition.
  useEffect(() => {
    const shape = checkSiteId(siteSlug);
    if (shape) return setSlugState({ ok: false, text: shape });
    if (order && order.siteSlug === siteSlug) return setSlugState({ ok: true, text: '✓ Available' });
    const t = setTimeout(async () => {
      const d = await fetch(`/api/sales/slug-check?slug=${encodeURIComponent(siteSlug)}`).then((r) => r.json()).catch(() => null);
      setSlugState(d ? (d.available ? { ok: true, text: '✓ Available' } : { ok: false, text: d.reason }) : null);
    }, 300);
    return () => clearTimeout(t);
  }, [siteSlug, order]);

  useEffect(() => {
    if (plan !== 'starter' && mode === 'declined') setMode('forwarded');
  }, [plan, mode]);

  const p = prices?.[plan];
  const recurring = p ? (period === 'annual' ? p.annual : p.monthly) : null;

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    const { ok, data } = await post<{ order: OperatorOrder } & TermsView>('/api/sales/orders', {
      leadId: lead.id,
      siteSlug,
      plan,
      period,
      vertical,
      receptionistMode: mode,
      forwardingNumber,
      client: { legalName, dba, entityType, address, contactName, contactTitle, email, phone },
    });
    setBusy(false);
    if (!ok || !data.order) return setError(data.error ?? 'Could not save the order.');
    onSaved(data.order, { script: data.script, termsHash: data.termsHash, totals: data.totals });
  }

  const modes: { id: Mode; title: string; body: string; disabled?: boolean }[] = [
    { id: 'forwarded', title: 'Keep your current number', body: 'Customers keep calling the number you use today. Calls you miss forward to your receptionist.' },
    { id: 'published', title: 'Get a new number from us', body: 'A new local number for your cards, truck and Google listing. It rings you first, and calls you miss go to your receptionist.' },
    { id: 'declined', title: 'Website only', body: plan === 'starter' ? 'No receptionist.' : 'Starter plan only.', disabled: plan !== 'starter' },
  ];

  return (
    <Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="field-label">Plan</span>
          <div className="flex flex-wrap gap-1.5">
            {(['starter', 'growth'] as Plan[]).map((id) => (
              <Chip key={id} on={plan === id} onClick={() => setPlan(id)}>
                <span className="font-bold">{prices?.[id]?.name ?? (id === 'starter' ? 'Starter' : 'Growth')}</span>
                <span className="text-xs text-fg2">{prices?.[id] ? `${money(prices[id].monthly)}/mo` : ' '}</span>
              </Chip>
            ))}
            <Chip on={false} onClick={() => {}} disabled>
              <span className="font-bold">Enterprise</span>
              <span className="text-xs text-fg2">Not on calls yet</span>
            </Chip>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="field-label">Billing</span>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={period === 'monthly'} onClick={() => setPeriod('monthly')}>
              <span className="font-bold">Monthly</span>
              <span className="text-xs text-fg2">{p ? `${money(p.monthly)}/mo` : ' '}</span>
            </Chip>
            <Chip on={period === 'annual'} onClick={() => setPeriod('annual')}>
              <span className="font-bold">Annual</span>
              <span className="text-xs text-fg2">{p ? `${money(p.annual)}/yr · 2 months free` : ' '}</span>
            </Chip>
          </div>
        </div>
      </div>

      {p && recurring != null && (
        <div className="flex flex-wrap gap-8 rounded-[10px] bg-[var(--panel-2)] px-4 py-3.5">
          <div>
            <div className="field-label">Due today</div>
            <div className="font-display text-3xl font-bold leading-tight">{money(recurring + p.onboardingFee)}</div>
            <div className="text-xs text-fg2">
              {period === 'annual' ? 'First year' : 'First month'} {money(recurring)} + onboarding {money(p.onboardingFee)}
            </div>
          </div>
          <div>
            <div className="field-label">Then</div>
            <div className="font-display text-3xl font-bold leading-tight">
              {money(recurring)}/{period === 'annual' ? 'yr' : 'mo'}
            </div>
            <div className="text-xs text-fg2">Renews automatically · cancel any time</div>
          </div>
        </div>
      )}

      <h2 className="text-base font-semibold text-fg">Business</h2>
      <div className="-mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Legal business name"><input className="input" value={legalName} onChange={(e) => setLegalName(e.target.value)} /></Field>
        <Field label="Business name (DBA)"><input className="input" value={dba} onChange={(e) => setDba(e.target.value)} /></Field>
        <Field label="Entity type">
          <select className="input" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            {ENTITY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Business address"><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state ZIP" /></Field>
        <Field label="Trade">
          <select className="input" value={vertical} onChange={(e) => setVertical(e.target.value)}>
            {verticals.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </Field>
        <Field
          label="Site ID"
          hint={slugState && <span className="text-xs font-semibold" style={{ color: slugState.ok ? 'var(--ok)' : 'var(--danger)' }}>{slugState.text}</span>}
        >
          <input className="input font-mono" value={siteSlug} onChange={(e) => setSiteSlug(e.target.value.trim().toLowerCase())} />
        </Field>
        <Field label="Contact name"><input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} /></Field>
        <Field label="Title"><input className="input" value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} /></Field>
        <Field label="Email (portal login)"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Contact mobile"><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      </div>

      <h2 className="text-base font-semibold text-fg">Phone setup</h2>
      <div className="-mt-2 grid gap-2.5 sm:grid-cols-3">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={m.disabled}
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`flex flex-col items-start gap-1 rounded-[10px] px-3.5 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
              mode === m.id && !m.disabled ? 'border-2 border-[var(--accent)] bg-[rgba(31,111,120,0.10)]' : 'm-px border border-[var(--rule-strong)] bg-[var(--panel)]'
            }`}
          >
            <span className="text-sm font-bold text-fg">{m.title}</span>
            <span className="text-[13px] text-fg2">{m.body}</span>
          </button>
        ))}
      </div>
      {mode === 'forwarded' && (
        <div className="max-w-[360px]">
          <Field
            label="Your current business number"
            hint={<span className="text-xs text-fg2">The number customers call today. We’ll send forwarding steps for your carrier.</span>}
          >
            <input className="input" type="tel" value={forwardingNumber} onChange={(e) => setForwardingNumber(e.target.value)} />
          </Field>
        </div>
      )}
      {mode === 'published' && <div className="text-[13px] text-fg2">Your new number is assigned during setup and emailed to you.</div>}

      <ErrorLine text={error} />
      <div className="flex justify-end gap-2.5">
        <button type="button" className="btn" disabled={busy} onClick={save}>Save draft</button>
        <button type="button" className="btn btn-primary" disabled={busy || slugState?.ok === false} onClick={save}>
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </Card>
  );
}

// ── Terms ───────────────────────────────────────────────────────────────────

function TermsStep({
  order,
  terms,
  onAccepted,
  onContinue,
}: {
  order: OperatorOrder;
  terms: TermsView;
  onAccepted: (order: OperatorOrder) => void;
  onContinue: () => void;
}) {
  const accepted = order.status !== 'draft';
  const [read, setRead] = useState<boolean[]>(() => terms.script.lines.map(() => accepted));
  const [agreed, setAgreed] = useState(accepted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const { ok, data } = await post<{ order: OperatorOrder }>(`/api/sales/orders/${order.id}/accept-terms`, {
      confirmed: true,
      scriptHash: terms.script.hash,
      termsHash: terms.termsHash,
    });
    setBusy(false);
    if (!ok || !data.order) return setError(data.error ?? 'Could not record the agreement.');
    onAccepted(data.order);
  }

  return (
    <Card>
      <ol className="flex flex-col gap-2">
        {terms.script.lines.map((line, i) => (
          <li key={i}>
            <label
              className="flex cursor-pointer items-start gap-3 rounded-[10px] border px-3.5 py-3"
              style={{
                background: read[i] ? 'rgba(31,111,120,0.07)' : 'var(--panel)',
                borderColor: read[i] ? 'rgba(31,111,120,0.3)' : 'var(--rule)',
                color: read[i] ? 'var(--fg-2)' : 'var(--fg)',
              }}
            >
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 flex-none accent-[var(--accent)]"
                checked={read[i]}
                disabled={accepted}
                onChange={() => setRead((r) => r.map((v, j) => (j === i ? !v : v)))}
              />
              <span className="text-base leading-normal">{line}</span>
            </label>
          </li>
        ))}
      </ol>

      <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-[var(--rule-strong)] bg-[var(--panel)] px-4 py-3.5">
        <input type="checkbox" className="h-[22px] w-[22px] flex-none accent-[var(--accent)]" checked={agreed} disabled={accepted} onChange={() => setAgreed((a) => !a)} />
        <span className="text-base"><span className="font-bold">Client verbally agreed</span> to the terms above</span>
      </label>

      <ErrorLine text={error} />
      {!accepted ? (
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" disabled={busy || !agreed || !read.every(Boolean)} onClick={accept}>
            {busy ? 'Saving…' : 'Accept terms'}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-[10px] border px-4 py-3.5" style={{ borderColor: 'var(--ok)', background: 'var(--ok-glow)' }}>
          <span><span className="font-bold" style={{ color: 'var(--ok)' }}>✓ Terms accepted.</span> A copy is on its way to {order.client.email}.</span>
          <button type="button" className="btn btn-primary" onClick={onContinue}>Continue</button>
        </div>
      )}
    </Card>
  );
}

// ── Payment ─────────────────────────────────────────────────────────────────

function PaymentStep({
  order,
  totals,
  onOrder,
  onPaid,
  onCancelled,
}: {
  order: OperatorOrder;
  totals: TermsView['totals'] | null;
  onOrder: (o: OperatorOrder) => void;
  onPaid: (o: OperatorOrder) => void;
  onCancelled: () => void;
}) {
  const [tab, setTab] = useState<'link' | 'card'>('link');
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(order.status === 'awaiting-payment');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expired = order.status === 'expired';

  // Open (or fetch) the link as the step appears. Idempotent at the agency.
  useEffect(() => {
    if (order.status !== 'terms-accepted' && order.status !== 'awaiting-payment') return;
    let cancelled = false;
    (async () => {
      const { ok, data } = await post<{ order: OperatorOrder; shortUrl: string }>(`/api/sales/orders/${order.id}/payment`, { method: 'link' });
      if (cancelled) return;
      if (!ok) return setError(data.error ?? 'Could not open a payment link.');
      setShortUrl(data.shortUrl);
      if (data.order) onOrder(data.order);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  // Poll while waiting. The agency's GET also checks Stripe when the webhook is late.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => {
      const d = await fetch(`/api/sales/orders/${order.id}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      const o = d?.order as OperatorOrder | undefined;
      if (!o) return;
      onOrder(o);
      if (isOrderPaid(o.status)) {
        clearInterval(t);
        onPaid(o);
      } else if (o.status === 'expired' || o.status === 'cancelled') {
        setWaiting(false);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [waiting, order.id, onOrder, onPaid]);

  async function copy() {
    if (!shortUrl) return;
    await navigator.clipboard?.writeText(`https://${shortUrl}`).catch(() => {});
    setCopied(true);
    setWaiting(true);
  }

  async function resend() {
    setBusy(true);
    setError(null);
    const { ok, data } = await post<{ order: OperatorOrder; shortUrl: string }>(`/api/sales/orders/${order.id}/resend-link`);
    setBusy(false);
    if (!ok) return setError(data.error ?? 'Could not make a new link.');
    setShortUrl(data.shortUrl);
    if (data.order) onOrder(data.order);
    setCopied(false);
  }

  async function cancel() {
    if (!window.confirm('Cancel this order? The payment link stops working.')) return;
    setBusy(true);
    const { ok, data } = await post(`/api/sales/orders/${order.id}/cancel`);
    setBusy(false);
    if (!ok) return setError(data.error ?? 'Could not cancel.');
    onCancelled();
  }

  const today = totals ? money(totals.today) : '';
  const then = totals ? `${money(totals.recurring)}/${totals.period === 'annual' ? 'yr' : 'mo'}` : '';

  return (
    <Card>
      {totals && (
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-display text-3xl font-bold leading-tight">{today}</span>
          <span className="text-fg2">due today, then {then}</span>
        </div>
      )}

      {!waiting && (
        <>
          <div role="tablist" className="flex flex-wrap gap-1.5">
            <button type="button" role="tab" aria-selected={tab === 'link'} onClick={() => setTab('link')} className={`btn ${tab === 'link' ? 'border-2 border-fg' : ''}`}>Link</button>
            <button type="button" role="tab" aria-selected={tab === 'card'} onClick={() => setTab('card')} className={`btn ${tab === 'card' ? 'border-2 border-fg' : ''}`}>Enter card</button>
          </div>

          {tab === 'link' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-2 rounded-xl border border-[var(--rule)] bg-[var(--panel)] p-4">
                <div className="field-label">Payment link</div>
                <div className="break-all font-display text-[34px] font-bold leading-tight">{shortUrl ?? (expired ? 'Link expired' : '…')}</div>
                <div className="text-[13px] text-fg2">Secure checkout by Stripe · expires in 24 hours</div>
              </div>
              <div className="flex gap-2.5">
                {expired ? (
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={resend}>New link</button>
                ) : (
                  <button type="button" className="btn btn-primary" disabled={!shortUrl} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
                )}
              </div>
            </div>
          )}
          {tab === 'card' && (
            <div className="rounded-xl border border-[var(--rule)] bg-[var(--panel)] p-4 text-fg2">Not enabled yet</div>
          )}
        </>
      )}

      {waiting && (
        <div className="flex flex-col gap-4 rounded-xl border p-5" style={{ borderColor: 'rgba(31,111,120,0.35)', background: 'rgba(31,111,120,0.06)' }}>
          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 animate-pulse rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 0 6px rgba(31,111,120,0.18)' }} />
            <div className="text-lg font-bold">Waiting for payment…</div>
          </div>
          <ol className="flex flex-col gap-2">
            <li className="flex gap-2.5"><span className="w-[18px] font-bold" style={{ color: 'var(--ok)' }}>✓</span>Terms accepted</li>
            <li className="flex gap-2.5"><span className="w-[18px] font-bold" style={{ color: 'var(--ok)' }}>✓</span>Payment link opened</li>
            <li className="flex gap-2.5"><span className="w-[18px] font-bold" style={{ color: 'var(--accent)' }}>…</span>Payment</li>
          </ol>
          <div className="flex flex-wrap gap-2.5">
            {shortUrl && <span className="codechip self-center">{shortUrl}</span>}
            <button type="button" className="btn" disabled={busy} onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}
      <ErrorLine text={error} />
    </Card>
  );
}

// ── Setup ───────────────────────────────────────────────────────────────────

interface ConvertResult {
  ok: boolean;
  steps: { id: 'folder' | 'lead' | 'recorded'; ok: boolean; detail: string }[];
}

function SetupStep({ order, onOrder, onContinue }: { order: OperatorOrder; onOrder: (o: OperatorOrder) => void; onContinue: () => void }) {
  const [convert, setConvert] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const fulfilled = order.status === 'fulfilled';

  // The agency fulfils (portal account + invite) right after payment; wait for that, then convert.
  useEffect(() => {
    if (fulfilled) return;
    const t = setInterval(async () => {
      const d = await fetch(`/api/sales/orders/${order.id}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      if (d?.order) onOrder(d.order);
    }, 2000);
    return () => clearInterval(t);
  }, [fulfilled, order.id, onOrder]);

  useEffect(() => {
    if (!fulfilled || started.current) return;
    started.current = true;
    (async () => {
      const { data } = await post<ConvertResult>(`/api/sales/orders/${order.id}/convert`);
      if (!data.steps) return setError(data.error ?? 'Could not finish setting up.');
      setConvert(data as ConvertResult);
    })();
  }, [fulfilled, order.id]);

  const folder = convert?.steps.find((s) => s.id === 'folder');
  const lead = convert?.steps.find((s) => s.id === 'lead');
  const amount = order.payment?.amountTotal != null ? money(order.payment.amountTotal / 100) : '';
  const results: { text: string; sub: string; ok: boolean | null }[] = [
    { text: 'Payment received', sub: `${amount}${amount ? ' · ' : ''}receipt sent to ${order.client.email}`, ok: isOrderPaid(order.status) },
    { text: 'Portal account created', sub: order.client.email, ok: fulfilled ? true : null },
    {
      text: order.invite?.kind === 'existing-login' ? 'Site added to your existing login' : 'Portal invite sent',
      sub: order.invite?.kind === 'existing-login' ? 'Sign in as usual' : 'Welcome email with a link to set up your login',
      ok: order.invite ? true : null,
    },
    { text: 'Client file created', sub: folder?.ok === false ? folder.detail : `Site ID ${order.siteSlug}`, ok: folder ? folder.ok : null },
    { text: 'Lead marked won', sub: lead?.ok === false ? lead.detail : 'Moved to Clients', ok: lead ? lead.ok : null },
  ];
  const ready = results.findIndex((r) => r.ok === null);
  const available = ready === -1 ? results.length : ready;
  const shown = useReveal(available, true);
  const items: ChecklistItem[] = results.map((r, i) => ({
    text: r.text,
    sub: r.sub,
    state: i < shown ? (r.ok === false ? 'failed' : 'done') : i === shown ? 'now' : 'todo',
  }));
  const done = shown >= results.length;
  const name = order.client.dba || order.client.legalName;

  return (
    <Card>
      <h2 className="text-xl font-semibold text-fg">{done ? `${name} is set up` : `Setting up ${name}…`}</h2>
      <Checklist items={items} />
      <ErrorLine text={error} />
      {done && (
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={onContinue}>Continue</button>
        </div>
      )}
    </Card>
  );
}

// ── SMS registration ────────────────────────────────────────────────────────

/**
 * The A2P chain's own panel in its `close-wizard` variant (A2P handoff §1C). It is the only EIN
 * form there is, so the wizard builds none: it hands over what the order already knows and the
 * panel does the form, the one typed-slug confirm, the batch filing and its checklist.
 *
 * "Business profile submitted, messaging registration pending" is a normal on-call outcome:
 * Twilio may not accept the trust bundle until the profile reaches in-review, and pressing Submit
 * again later (from Resume) carries on. So Continue is always available here.
 */
function SmsStep({ order, enums, onContinue }: { order: OperatorOrder; enums: A2pEnums | null; onContinue: () => void }) {
  const [first, ...rest] = order.client.contactName.trim().split(/\s+/);
  return (
    <Card>
      <h2 className="text-xl font-semibold text-fg">SMS registration</h2>
      {enums ? (
        <A2pRegistrationPanel
          slug={order.siteSlug}
          enums={enums}
          variant="close-wizard"
          vertical={order.vertical}
          prefill={{
            legalBusinessName: order.client.legalName,
            repFirstName: first,
            repLastName: rest.join(' '),
            repEmail: order.client.email,
            repPhone: order.client.phone,
            address: order.client.address,
          }}
        />
      ) : (
        <div className="text-fg2">The registration tools aren’t available right now.</div>
      )}
      <div className="flex justify-end">
        <button type="button" className="btn btn-primary" onClick={onContinue}>Continue</button>
      </div>
    </Card>
  );
}

// ── Done ────────────────────────────────────────────────────────────────────

function DoneStep({ order }: { order: OperatorOrder }) {
  const [lights, setLights] = useState<ReadinessLight[] | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [resent, setResent] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch('/api/sales/readiness', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    const mine = d?.readiness?.[order.siteSlug];
    if (mine) {
      setLights(mine.lights);
      setCanResend(mine.canResendInvite);
    }
  }, [order.siteSlug]);
  useEffect(() => {
    load();
  }, [load]);

  async function resendInvite() {
    const { ok, data } = await post(`/api/sales/orders/${order.id}/resend-invite`);
    setResent(ok ? `Sent to ${order.client.email}` : data.error ?? 'Could not resend.');
  }

  const amount = order.payment?.amountTotal != null ? money(order.payment.amountTotal / 100) : 'Your payment';
  const existing = order.invite?.kind === 'existing-login';
  const next: { title: string; body: string; done: boolean; resend?: boolean }[] = [
    { title: 'Terms confirmation', body: `Emailed to ${order.client.email} with the PDF.`, done: true },
    { title: 'Payment collected', body: `${amount} received. Your receipt is from Stripe.`, done: true },
    existing
      ? { title: 'Sign in as usual', body: 'Your new site is on the portal login you already have.', done: false }
      : { title: 'Set up your portal login', body: 'Open the welcome email from Juneau Digital Designs and follow the link to choose how you sign in.', done: false, resend: true },
    { title: 'Complete onboarding in the portal', body: 'Tell us about your brand and services and add your photos. Once it’s in, we start building your site.', done: false },
  ];

  return (
    <Card>
      <h2 className="font-display text-[34px] font-bold leading-none text-fg">You’re all set</h2>
      {lights && <ReadinessStrip lights={lights} />}
      <div className="flex flex-col gap-2.5">
        <h3 className="text-base font-semibold text-fg">Next steps</h3>
        <ol className="flex flex-col gap-2">
          {next.map((n, i) => (
            <li key={n.title} className="flex items-start gap-3 rounded-[10px] border border-[var(--rule)] bg-[var(--panel)] px-3.5 py-3">
              <span
                className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold"
                style={n.done ? { background: 'var(--ok)', color: '#fff' } : { border: '2px solid var(--accent)', color: 'var(--accent)' }}
              >
                {n.done ? '✓' : i + 1}
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-semibold text-fg">{n.title}</span>
                <span className="text-[13px] text-fg2">{n.body}</span>
                {n.resend && resent && <span className="text-[13px] text-fg2">{resent}</span>}
              </span>
              {n.resend && canResend && (
                <button type="button" className="btn btn-sm flex-none" onClick={resendInvite}>Resend invite</button>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div className="flex justify-end">
        <Link href={`/c/${order.siteSlug}`} className="btn btn-primary">Open client</Link>
      </div>
    </Card>
  );
}
