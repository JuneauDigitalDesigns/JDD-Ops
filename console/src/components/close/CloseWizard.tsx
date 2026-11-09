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
import { loadStripe, type Stripe as StripeJs, type StripeCardNumberElement } from '@stripe/stripe-js';

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
  script: { version: string; hash: string; recordingNotice: string; recordingOpener: string; lines: string[] };
  termsHash: string;
  totals: { today: number; recurring: number; period: Period; nextPaymentAt?: number };
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

async function post<T = Record<string, unknown>>(url: string, body: unknown = {}): Promise<{ ok: boolean; data: T & { error?: string; code?: string } }> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
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

  // The plan chosen on the Order step drives the stepper live: pick Starter and the SMS step is
  // gone before anything is saved. It used to read only the saved order, so until the first save
  // a Starter close showed an SMS registration step it would never have.
  const [draftPlan, setDraftPlan] = useState<Plan | null>(null);
  const plan: Plan =
    (step === 'order' ? draftPlan : null) ??
    (order?.plan as Plan) ??
    draftPlan ??
    (lead.planInterest === 'starter' ? 'starter' : 'growth');
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
            onPlanChange={setDraftPlan}
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
            termsVersion={terms?.script.version.split('-')[0] ?? null}
            onOrder={setOrder}
            onRecordingRunning={() => setStep('terms')}
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
  onPlanChange,
  onSaved,
}: {
  lead: LeadInfo;
  order: OperatorOrder | null;
  prices: Prices | null;
  verticals: { id: string; label: string }[];
  onPlanChange: (plan: Plan) => void;
  onSaved: (order: OperatorOrder, terms: TermsView) => void;
}) {
  const c = order?.client;
  const [plan, setPlan] = useState<Plan>((order?.plan as Plan) ?? (lead.planInterest === 'starter' ? 'starter' : 'growth'));
  const [period, setPeriod] = useState<Period>(order?.period ?? 'monthly');
  useEffect(() => onPlanChange(plan), [plan, onPlanChange]);
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
            </Chip>
            <Chip on={period === 'annual'} onClick={() => setPeriod('annual')}>
              <span className="font-bold">Annual</span>
              <span className="text-xs text-fg2">2 months free</span>
            </Chip>
          </div>
        </div>
      </div>

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
        <Field label="Email (portal login)" hint={<span className="text-xs text-fg2">Receives the portal login, as well as the agreement.</span>}><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
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

interface AgreementSummary {
  method: 'read-aloud' | 'agreement-link';
  acceptedAt: string;
  signerName: string;
  signerTitle: string;
  businessName: string;
  version: string;
  emailedTo: string;
  /** Read-aloud only. */
  call: { recordingConsentAt: string | null; recordingStoppedAt: string | null; recording: unknown | null } | null;
}

type TermsMode = 'options' | 'aloud' | 'link' | 'recorded' | 'confirm';

/**
 * Accepting the terms, one of two ways (mockup: https://claude.ai/artifact/TvSLZo2M3JV4qVT784wm5p):
 * the script read aloud with a verbal yes, or a private link where the client reads the full
 * agreement and agrees themselves. Both end on the same confirmation, with the signed copy.
 */
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
  const [mode, setMode] = useState<TermsMode>(order.status !== 'draft' ? 'confirm' : 'options');
  // The opener is read first, on the recording, and ticked off like every other line.
  const spoken = [terms.script.recordingOpener, ...terms.script.lines];
  const [read, setRead] = useState<boolean[]>(() => spoken.map(() => false));
  const [consentAt, setConsentAt] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState<AgreementSummary | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const { ok, data } = await post<{ order: OperatorOrder; agreement?: AgreementSummary | null }>(`/api/sales/orders/${order.id}/accept-terms`, {
      confirmed: true,
      scriptHash: terms.script.hash,
      termsHash: terms.termsHash,
      recordingConsentAt: consentAt,
    });
    setBusy(false);
    if (!ok || !data.order) return setError(data.error ?? 'Could not record the agreement.');
    setSummary(data.agreement ?? null);
    onAccepted(data.order);
    setMode('confirm');
  }

  // The recording has to be off before payment: card details must never be on it.
  const needsStop = Boolean(summary?.call?.recordingConsentAt && !summary.call.recordingStoppedAt);

  async function continueToPayment() {
    if (needsStop) {
      setBusy(true);
      setError(null);
      const { ok, data } = await post(`/api/sales/orders/${order.id}/recording-stopped`);
      setBusy(false);
      if (!ok) return setError(data.error ?? 'Could not save.');
    }
    onContinue();
  }

  async function openLink(fresh = false) {
    setBusy(true);
    setError(null);
    const { ok, data } = await post<{ shortUrl: string; order?: OperatorOrder }>(`/api/sales/orders/${order.id}/agreement-link`, { fresh });
    setBusy(false);
    if (!ok) return setError(data.error ?? 'Could not create the agreement link.');
    setShortUrl(data.shortUrl);
    setCopied(false);
  }

  function showLink() {
    setMode('link');
    void openLink();
  }

  async function copy() {
    if (!shortUrl) return;
    await navigator.clipboard?.writeText(`https://${shortUrl}`).catch(() => {});
    setCopied(true);
  }

  // While the link is out, watch for the client agreeing on their own device.
  useEffect(() => {
    if (mode !== 'link') return;
    const t = setInterval(async () => {
      const d = await fetch(`/api/sales/orders/${order.id}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      const o = d?.order as OperatorOrder | undefined;
      if (!o || o.status === 'draft') return;
      clearInterval(t);
      setSummary((d.agreement as AgreementSummary | null) ?? null);
      onAccepted(o);
      setMode('recorded');
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, order.id]);

  // Reopening a close whose terms are already accepted.
  useEffect(() => {
    if (mode !== 'confirm' || summary) return;
    let cancelled = false;
    fetch(`/api/sales/orders/${order.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.agreement) setSummary(d.agreement as AgreementSummary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, summary, order.id]);

  if (mode === 'options') {
    return (
      <Card>
        <h2 className="text-[22px] font-bold text-fg">Terms review</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="terms-option" onClick={() => setMode('aloud')}>
            <b>Read aloud</b>
            <span>Summary read on the call. Verbal agreement.</span>
          </button>
          <button type="button" className="terms-option" onClick={showLink}>
            <b>Agreement link</b>
            <span>Full agreement by private link. Agreed online.</span>
          </button>
        </div>
      </Card>
    );
  }

  if (mode === 'link') {
    return (
      <Card>
        <h2 className="text-[22px] font-bold text-fg">Terms review</h2>
        <div className="flex flex-col gap-1 rounded-xl border border-[var(--rule)] bg-[var(--panel)] p-4">
          <div className="field-label">Agreement link</div>
          <div className="break-all font-display text-[30px] font-bold leading-tight">{shortUrl ?? '…'}</div>
          <div className="text-[13px] text-fg2">Private to this order · expires in 24 hours</div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className="btn btn-primary" disabled={!shortUrl} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
          <button type="button" className="btn" disabled={busy || !shortUrl} onClick={() => openLink(true)}>New link</button>
        </div>
        <div role="status" className="moto-status moto-status-wait">
          <span className="moto-status-dot"><i /></span>
          <div>
            <div className="font-semibold">Waiting for agreement…</div>
            <div className="text-[13px] text-fg2">Updates automatically.</div>
          </div>
        </div>
        <ErrorLine text={error} />
        <div>
          <button type="button" className="btn moto-quiet" onClick={() => setMode('aloud')}>Switch to read aloud</button>
        </div>
      </Card>
    );
  }

  if (mode === 'recorded') {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full" style={{ background: 'var(--ok)' }} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <h2 className="font-display text-[34px] font-bold leading-none text-fg">Agreement recorded</h2>
          <p className="m-0 text-fg2">Copy sent to {order.client.email}.</p>
          <button type="button" className="btn btn-primary" onClick={() => setMode('confirm')}>Next</button>
        </div>
      </Card>
    );
  }

  if (mode === 'confirm') {
    const pdf = `/api/sales/orders/${order.id}/agreement-pdf`;
    const planName = order.plan.charAt(0).toUpperCase() + order.plan.slice(1);
    const document = summary?.version.startsWith('addendum')
      ? `Site Addendum ${summary.version.replace('addendum-', '')}, ${planName}`
      : `Terms of Service ${summary?.version ?? ''}, ${planName}`;
    const when = summary
      ? `${new Date(summary.acceptedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/New_York' })} ET`
      : '';
    return (
      <Card>
        <div className="rounded-[10px] border px-4 py-3.5" style={{ borderColor: 'var(--ok)', background: 'var(--ok-glow)' }}>
          <span className="font-bold" style={{ color: 'var(--ok)' }}>✓ Terms accepted</span>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {summary ? (
            <dl className="terms-facts">
              <dt>Accepted by</dt><dd>{summary.signerName}, {summary.signerTitle}</dd>
              <dt>Business</dt><dd>{summary.businessName}</dd>
              <dt>Method</dt><dd>{summary.method === 'read-aloud' ? 'Read aloud' : 'Agreement link'}</dd>
              <dt>Date</dt><dd>{when}</dd>
              <dt>Document</dt><dd>{document}</dd>
              <dt>Copy sent to</dt><dd>{summary.emailedTo}</dd>
              <dt>Client record</dt><dd>Saved</dd>
              {summary.call?.recordingConsentAt && (
                <><dt>Recording</dt><dd>{summary.call.recording ? 'Attached' : 'To attach'}</dd></>
              )}
            </dl>
          ) : (
            <div className="text-fg2">…</div>
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <div className="field-label">Accepted terms</div>
            <iframe title="Accepted terms" src={pdf} className="h-[300px] w-full rounded-[10px] border border-[var(--rule)] bg-white" />
            <div>
              <a className="btn" href={pdf} target="_blank" rel="noopener noreferrer">Open PDF</a>
            </div>
          </div>
        </div>
        {needsStop && (
          <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-[var(--rule-strong)] bg-[var(--panel)] px-4 py-3.5">
            <input type="checkbox" className="h-[22px] w-[22px] flex-none accent-[var(--accent)]" checked={stopped} onChange={() => setStopped((s) => !s)} />
            <span className="text-base font-bold">Recording stopped</span>
          </label>
        )}
        <ErrorLine text={error} />
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" disabled={busy || (needsStop && !stopped)} onClick={continueToPayment}>Continue</button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-2.5 rounded-[10px] border border-[var(--rule-strong)] bg-[var(--panel)] p-4">
        <div className="field-label">Recording notice</div>
        <p className="m-0 text-base leading-normal text-fg">{terms.script.recordingNotice}</p>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-[22px] w-[22px] flex-none accent-[var(--accent)]"
            checked={consentAt !== null}
            onChange={() => setConsentAt((at) => (at ? null : new Date().toISOString()))}
          />
          <span className="text-base font-bold">Client consented to recording</span>
        </label>
      </div>

      <ol className="flex flex-col gap-2" style={consentAt ? undefined : { opacity: 0.5 }}>
        {spoken.map((line, i) => (
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
                disabled={!consentAt}
                onChange={() => setRead((r) => r.map((v, j) => (j === i ? !v : v)))}
              />
              <span className="text-base leading-normal">{line}</span>
            </label>
          </li>
        ))}
      </ol>

      <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-[var(--rule-strong)] bg-[var(--panel)] px-4 py-3.5">
        <input type="checkbox" className="h-[22px] w-[22px] flex-none accent-[var(--accent)]" checked={agreed} onChange={() => setAgreed((a) => !a)} />
        <span className="text-base"><span className="font-bold">Client verbally agreed</span> to the terms above</span>
      </label>

      <ErrorLine text={error} />
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button type="button" className="btn moto-quiet" onClick={showLink}>Switch to agreement link</button>
        <button type="button" className="btn btn-primary" disabled={busy || !consentAt || !agreed || !read.every(Boolean)} onClick={accept}>
          {busy ? 'Saving…' : 'Accept terms'}
        </button>
      </div>
    </Card>
  );
}

// ── Payment ─────────────────────────────────────────────────────────────────

function PaymentStep({
  order,
  totals,
  termsVersion,
  onOrder,
  onRecordingRunning,
  onPaid,
  onCancelled,
}: {
  order: OperatorOrder;
  onRecordingRunning: () => void;
  totals: TermsView['totals'] | null;
  /** "v5.3": the Terms of Service version the checkout says was accepted. */
  termsVersion: string | null;
  onOrder: (o: OperatorOrder) => void;
  onPaid: (o: OperatorOrder) => void;
  onCancelled: () => void;
}) {
  const onCard = order.payment?.method === 'dashboard-moto';
  const [tab, setTab] = useState<'link' | 'card'>(onCard ? 'card' : 'link');
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(order.status === 'awaiting-payment' && !onCard);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expired = order.status === 'expired';

  // Open (or fetch) the link while the Link tab is showing. Idempotent at the agency, and from
  // the card path it switches back to a link (the agency refuses while a charge is running).
  useEffect(() => {
    if (tab !== 'link') return;
    if (order.status !== 'terms-accepted' && order.status !== 'awaiting-payment') return;
    let cancelled = false;
    (async () => {
      const { ok, data } = await post<{ order: OperatorOrder; shortUrl: string }>(`/api/sales/orders/${order.id}/payment`, { method: 'link' });
      if (cancelled) return;
      // Reopened on Payment with the recording not confirmed stopped: back to that tick.
      if (data.code === 'recording-running') return onRecordingRunning();
      if (!ok) return setError(data.error ?? 'Could not open a payment link.');
      setError(null);
      setShortUrl(data.shortUrl);
      if (data.order) onOrder(data.order);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, tab]);

  // Poll while waiting on the link. The agency's GET also checks Stripe when the webhook is late.
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
    if (!expired && !window.confirm('New link replaces the current one.')) return;
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

  function switchTo(next: 'link' | 'card') {
    setError(null);
    setWaiting(false);
    setCopied(false);
    if (next === 'card') setShortUrl(null);
    setTab(next);
  }

  // The card path is a checkout of its own, with its own header (CardFlow).
  if (tab === 'card' && !waiting) {
    return (
      <Card>
        <CardFlow order={order} totals={totals} termsVersion={termsVersion} onOrder={onOrder} onPaid={onPaid} onUseLink={() => switchTo('link')} />
      </Card>
    );
  }

  return (
    <Card>
      <LinkCheckout
        order={order}
        totals={totals}
        termsVersion={termsVersion}
        shortUrl={shortUrl}
        expired={expired}
        waiting={waiting}
        copied={copied}
        busy={busy}
        error={error}
        onCopy={copy}
        onOpened={() => setWaiting(true)}
        onNewLink={resend}
        onSwitchToCard={() => switchTo('card')}
        onCancel={cancel}
      />
    </Card>
  );
}

/**
 * The payment link, on the same checkout as the card path: the order summary on the left, and
 * the link where the card field would be. While a link is live it can always be copied again,
 * opened, or replaced; the old panel offered only Switch to card and Cancel, which read as stuck.
 */
function LinkCheckout({
  order,
  totals,
  termsVersion,
  shortUrl,
  expired,
  waiting,
  copied,
  busy,
  error,
  onCopy,
  onOpened,
  onNewLink,
  onSwitchToCard,
  onCancel,
}: {
  order: OperatorOrder;
  totals: TermsView['totals'] | null;
  termsVersion: string | null;
  shortUrl: string | null;
  expired: boolean;
  waiting: boolean;
  copied: boolean;
  busy: boolean;
  error: string | null;
  onCopy: () => void;
  onOpened: () => void;
  onNewLink: () => void;
  onSwitchToCard: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="moto-checkout -m-6">
      {totals && (
        <OrderSummary
          order={order}
          recurringCents={Math.round(totals.recurring * 100)}
          amountCents={Math.round(totals.today * 100)}
          period={totals.period}
          nextPaymentAt={totals.nextPaymentAt ?? null}
        />
      )}
      <div className="moto-payside">
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold">Contact information</h3>
          <div className="moto-box"><div><span className="moto-k">Email</span><span>{order.client.email}</span></div></div>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold">Payment link</h3>
          <div className="moto-box">
            <div className="moto-linkbox">
              <div className="break-all font-display text-[30px] font-bold leading-tight">{shortUrl ?? (expired ? 'Link expired' : '…')}</div>
              <div className="text-[13px] text-fg3">Secure checkout by Stripe · expires in 24 hours</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {expired ? (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={onNewLink}>New link</button>
            ) : (
              <>
                <button type="button" className="btn btn-primary" disabled={!shortUrl} onClick={onCopy}>{copied ? 'Copied' : 'Copy link'}</button>
                <a
                  className={`btn ${shortUrl ? '' : 'pointer-events-none opacity-50'}`}
                  href={shortUrl ? `https://${shortUrl}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onOpened}
                >
                  Open link
                </a>
                <button type="button" className="btn" disabled={busy || !shortUrl} onClick={onNewLink}>New link</button>
              </>
            )}
          </div>
        </div>
        {waiting && !expired && (
          <div role="status" className="moto-status moto-status-wait">
            <span className="moto-status-dot"><i /></span>
            <div>
              <div className="font-semibold">Waiting for payment…</div>
              <div className="text-[13px] text-fg2">Updates automatically.</div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold">Billing details</h3>
          <div className="moto-box">
            <div><span className="moto-k">Name</span><span>{order.client.legalName}</span></div>
            <div><span className="moto-k">Address</span><span>{order.client.address}</span></div>
          </div>
        </div>
        <div className="moto-check">
          <span className="moto-cb" aria-hidden="true">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <span>
            You agreed to the Juneau Digital Designs Terms of Service{termsVersion ? ` (${termsVersion})` : ''} by phone today. A copy
            was emailed to you.
          </span>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-fg3">
          <LockIcon size={12} />
          Payments processed securely by Stripe
        </div>
        <ErrorLine text={error} />
        <div className="flex flex-wrap justify-center gap-[18px]">
          <button type="button" className="btn moto-quiet" disabled={busy} onClick={onSwitchToCard}>Switch to card</button>
          <button type="button" className="btn moto-quiet" disabled={busy} onClick={onCancel}>Cancel order</button>
        </div>
      </div>
    </div>
  );
}

interface ChargePreview {
  card: { id: string; brand: string; last4: string; expMonth: number | null; expYear: number | null } | null;
  amountCents: number;
  recurringCents: number;
  period: Period;
  stripeAmountCents: number | null;
  nextPaymentAt: number;
  statementDescriptor: string | null;
}

interface ChargeReceipt {
  amountPaidCents: number | null;
  paidAt: number | null;
  invoiceNumber: string | null;
  card: { brand: string; last4: string } | null;
  nextPaymentAt: number | null;
  nextAmountCents: number | null;
}

/** Checkout money: always with cents, the way a checkout and a receipt show it. */
const cents = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const longDate = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const cardName = (brand: string) => (brand === 'amex' ? 'American Express' : brand.charAt(0).toUpperCase() + brand.slice(1));

/** What the plan line under the plan name says it is. */
function planIncludes(order: OperatorOrder): string {
  if (order.plan === 'starter' && order.receptionistMode === 'declined') return 'Website';
  if (order.plan === 'starter') return 'Website and AI receptionist';
  return 'Website, AI receptionist and CRM';
}

/**
 * The card path, as the client sees it on a shared screen (approved mockup round 2,
 * https://claude.ai/artifact/5WaadEEADbGDbfEL473V3x):
 *
 *   1. entry: the card is typed into Stripe (a new tab, never this screen) while this polls the
 *      agency for "has a card been added?" (yes or no, nothing about the card). Continue to
 *      checkout unlocks on yes.
 *   2. checkout: laid out like a hosted subscription checkout. Subscribe charges exactly the
 *      amount the agency previewed, which it checks again.
 *   3. paid: the confirmation and receipt, from Stripe's own figures, then on to Setup.
 */
function CardFlow({
  order,
  totals,
  termsVersion,
  onOrder,
  onPaid,
  onUseLink,
}: {
  order: OperatorOrder;
  totals: TermsView['totals'] | null;
  termsVersion: string | null;
  onOrder: (o: OperatorOrder) => void;
  onPaid: (o: OperatorOrder) => void;
  onUseLink: () => void;
}) {
  const [stage, setStage] = useState<'entry' | 'checkout' | 'paid'>('entry');
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);
  const [cardAdded, setCardAdded] = useState(false);
  const [preview, setPreview] = useState<ChargePreview | null>(null);
  const [paid, setPaid] = useState<{ order: OperatorOrder; receipt: ChargeReceipt | null; statementDescriptor: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsLink, setNeedsLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const charging = useRef(false);
  /** Stripe's card field in the checkout, when the account takes phone orders through the API. */
  const [cardField, setCardField] = useState<{ publishableKey: string } | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const cardTokenizer = useRef<CardTokenizer | null>(null);

  // The Customer exists before the Dashboard does. Idempotent at the agency, which also closes a
  // live payment link first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, data } = await post<{
        order: OperatorOrder;
        dashboardUrl: string;
        cardEntry?: { inline: boolean; publishableKey: string | null };
      }>(`/api/sales/orders/${order.id}/payment`, {
        method: 'dashboard-moto',
      });
      if (cancelled) return;
      if (!ok) return setError(data.error ?? 'Could not set up card entry.');
      setDashboardUrl(data.dashboardUrl);
      if (data.order) onOrder(data.order);
      // One screen: when Stripe takes phone orders through the API, the card is typed into
      // Stripe's own field on the checkout. Otherwise the Dashboard form below.
      if (data.cardEntry?.inline && data.cardEntry.publishableKey) {
        const res = await fetch(`/api/sales/orders/${order.id}/charge`, { cache: 'no-store' });
        const pv = (await res.json().catch(() => null)) as ChargePreview | null;
        if (cancelled) return;
        if (res.ok && pv) {
          setPreview(pv);
          setCardField({ publishableKey: data.cardEntry.publishableKey });
          setStage('checkout');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  // Watch for the card while it's being typed into Stripe.
  useEffect(() => {
    if (stage !== 'entry' || !dashboardUrl || cardAdded || cardField) return;
    let stop = false;
    const check = async () => {
      const d = await fetch(`/api/sales/orders/${order.id}/charge?detect=1`, { cache: 'no-store' })
        .then((r) => r.json())
        .catch(() => null);
      if (!stop && d?.cardAdded === true) setCardAdded(true);
    };
    void check();
    const t = setInterval(check, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [stage, dashboardUrl, cardAdded, order.id]);

  async function toCheckout() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sales/orders/${order.id}/charge`, { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as ChargePreview & { error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? 'Could not read the card from Stripe.');
    if (!data.card) {
      setCardAdded(false);
      return setError('No card found yet. Add it in Stripe, then continue.');
    }
    setPreview(data);
    setNeedsLink(false);
    setStage('checkout');
  }

  function differentCard() {
    setPreview(null);
    setCardAdded(false);
    setError(null);
    setStage('entry');
  }

  async function subscribe() {
    if (!preview || charging.current) return;
    if (!cardField && !preview.card) return;
    charging.current = true; // one request per click; the agency refuses a second one anyway
    setBusy(true);
    setError(null);
    // The typed card goes from Stripe's field to Stripe, which hands back only a pm_… id.
    let paymentMethodId: string | undefined;
    if (cardField) {
      const t = await cardTokenizer.current?.tokenize();
      if (!t || 'error' in t) {
        setBusy(false);
        charging.current = false;
        return setError(t?.error ?? 'The card field is not ready yet.');
      }
      paymentMethodId = t.id;
    }
    const { ok, data } = await post<{
      order?: OperatorOrder;
      outcome?: string;
      code?: string;
      receipt?: ChargeReceipt | null;
      statementDescriptor?: string | null;
    }>(`/api/sales/orders/${order.id}/charge`, {
      amountCents: preview.amountCents,
      ...(paymentMethodId ? { paymentMethodId } : {}),
    });
    setBusy(false);
    charging.current = false;
    // Stripe hasn't switched on phone orders through the API after all: back to the Dashboard form.
    if (data.code === 'moto-unavailable') {
      setCardField(null);
      setPreview(null);
      setStage('entry');
      return setError(data.error ?? 'Add the card in Stripe instead.');
    }
    if (ok && data.outcome === 'paid' && data.order) {
      onOrder(data.order);
      setPaid({ order: data.order, receipt: data.receipt ?? null, statementDescriptor: data.statementDescriptor ?? null });
      setStage('paid');
      return;
    }
    if (data.outcome === 'requires_action') setNeedsLink(true);
    setError(data.error ?? 'The payment did not go through.');
  }

  // The confirmation stays up long enough to read, then the wizard moves on to Setup.
  useEffect(() => {
    if (stage !== 'paid' || !paid) return;
    const t = setTimeout(() => onPaid(paid.order), 6000);
    return () => clearTimeout(t);
  }, [stage, paid, onPaid]);

  if (stage === 'paid' && paid) return <CardPaid order={order} preview={preview} paid={paid} />;
  if (stage === 'checkout' && preview && (preview.card || cardField)) {
    return (
      <CardCheckout
        order={order}
        preview={preview}
        cardField={
          cardField ? (
            <StripeCardField
              publishableKey={cardField.publishableKey}
              billing={{ name: order.client.legalName, email: order.client.email, line1: order.client.address }}
              tokenizer={cardTokenizer}
              onComplete={setCardComplete}
            />
          ) : null
        }
        cardReady={cardField ? cardComplete : true}
        termsVersion={termsVersion}
        busy={busy}
        needsLink={needsLink}
        error={error}
        onSubscribe={subscribe}
        onDifferentCard={differentCard}
        onUseLink={onUseLink}
      />
    );
  }

  return (
    <div className="flex max-w-[720px] flex-col gap-5">
      {totals && (
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-display text-[34px] font-bold leading-none">{money(totals.today)}</span>
          <span className="text-fg2">
            due today, then {money(totals.recurring)} {totals.period === 'annual' ? 'a year' : 'a month'}
          </span>
        </div>
      )}
      <div className="flex items-start gap-3 rounded-xl bg-[var(--panel-2)] p-4">
        <LockIcon size={22} />
        <p className="m-0">
          <strong>Your card is entered directly into Stripe, our payment processor.</strong> It never passes through this
          screen, and nothing is charged until you&apos;ve reviewed your order.
        </p>
      </div>

      {cardAdded ? (
        <div role="status" className="moto-status moto-status-ok">
          <span className="moto-status-dot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <div>
            <div className="font-semibold">Card added</div>
            <div className="text-[13px] text-fg2">Saved securely in Stripe. Nothing has been charged.</div>
          </div>
        </div>
      ) : (
        <div role="status" className="moto-status moto-status-wait">
          <span className="moto-status-dot"><i /></span>
          <div>
            <div className="font-semibold">Waiting for the card…</div>
            <div className="text-[13px] text-fg2">This updates by itself once the card is saved in Stripe.</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <a
          className={`btn ${dashboardUrl ? '' : 'pointer-events-none opacity-50'}`}
          href={dashboardUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          {cardAdded ? 'Open Stripe again' : 'Add card in Stripe'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
        </a>
        <button type="button" className="btn btn-primary" disabled={!cardAdded || busy} onClick={toCheckout}>
          Continue to checkout
        </button>
        <button type="button" className="btn moto-quiet" disabled={busy} onClick={onUseLink}>
          Send a payment link instead
        </button>
      </div>
      <ErrorLine text={error} />
    </div>
  );
}

type CardTokenizer = { tokenize: () => Promise<{ id: string } | { error: string }> };

/**
 * Stripe's card field (Stripe Elements), laid out like a hosted checkout's "Card information":
 * number on top, expiry and CVC beneath. Each part is an iframe served by Stripe, so the card
 * number, expiry and CVC are typed into Stripe's page, never into this one: this component can't
 * read them, and nothing here or in the console ever holds them. `tokenize` asks Stripe to turn
 * what was typed into a PaymentMethod and hands back only its `pm_…` id.
 */
function StripeCardField({
  publishableKey,
  billing,
  tokenizer,
  onComplete,
}: {
  publishableKey: string;
  billing: { name: string; email: string; line1: string };
  tokenizer: React.MutableRefObject<CardTokenizer | null>;
  onComplete: (complete: boolean) => void;
}) {
  const numberRef = useRef<HTMLDivElement>(null);
  const expiryRef = useRef<HTMLDivElement>(null);
  const cvcRef = useRef<HTMLDivElement>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    let stripe: StripeJs | null = null;
    let number: StripeCardNumberElement | null = null;
    let destroyed = false;
    const done = { number: false, expiry: false, cvc: false };
    (async () => {
      stripe = await loadStripe(publishableKey);
      if (!stripe || destroyed || !numberRef.current || !expiryRef.current || !cvcRef.current) return;
      const elements = stripe.elements();
      const style = {
        base: { fontSize: '15px', color: '#14120c', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', '::placeholder': { color: '#9a917a' } },
        invalid: { color: '#d2542f' },
      };
      number = elements.create('cardNumber', { style, showIcon: true });
      const expiry = elements.create('cardExpiry', { style });
      const cvc = elements.create('cardCvc', { style });
      number.mount(numberRef.current);
      expiry.mount(expiryRef.current);
      cvc.mount(cvcRef.current);
      const watch = (key: keyof typeof done) => (e: { complete: boolean; error?: { message?: string } }) => {
        done[key] = e.complete;
        setFieldError(e.error?.message ?? null);
        onComplete(done.number && done.expiry && done.cvc);
      };
      number.on('change', watch('number'));
      expiry.on('change', watch('expiry'));
      cvc.on('change', watch('cvc'));
      tokenizer.current = {
        tokenize: async () => {
          if (!stripe || !number) return { error: 'The card field is not ready yet.' };
          const r = await stripe.createPaymentMethod({
            type: 'card',
            card: number,
            billing_details: { name: billing.name, email: billing.email, address: { line1: billing.line1 } },
          });
          return r.error ? { error: r.error.message ?? 'Stripe could not read the card.' } : { id: r.paymentMethod.id };
        },
      };
    })();
    return () => {
      destroyed = true;
      tokenizer.current = null;
      number?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishableKey]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="moto-box moto-cardfield">
        <div ref={numberRef} />
        <div className="moto-cardfield-row">
          <div ref={expiryRef} />
          <div ref={cvcRef} />
        </div>
      </div>
      {fieldError && (
        <div role="alert" className="text-[13px]" style={{ color: 'var(--danger)' }}>
          {fieldError}
        </div>
      )}
    </div>
  );
}

function LockIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="mt-0.5 flex-none">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** The order, as a hosted checkout lays it out. Both ways of paying show exactly this. */
function OrderSummary({
  order,
  recurringCents,
  amountCents,
  period,
  nextPaymentAt,
}: {
  order: OperatorOrder;
  recurringCents: number;
  amountCents: number;
  period: Period;
  nextPaymentAt: number | null;
}) {
  const unit = period === 'annual' ? 'year' : 'month';
  const onboardingCents = amountCents - recurringCents;
  const planName = order.plan.charAt(0).toUpperCase() + order.plan.slice(1);
  const billed = period === 'annual' ? 'Billed yearly · 12 months for the price of 10' : 'Billed monthly';
  return (
    <div className="moto-summary">
      <div className="flex items-center gap-2.5 font-semibold">
        <span className="text-fg3" aria-hidden="true">←</span>
        <span className="moto-mark" aria-hidden="true">J</span>
        Juneau Digital Designs
      </div>
      <div>
        <div className="font-medium text-fg3">Subscribe to {planName}</div>
        <div className="mt-1 flex items-baseline gap-2 tabular-nums">
          <b className="font-display text-[44px] font-bold leading-none">{cents(recurringCents)}</b>
          <span className="text-sm leading-tight text-fg3">
            per
            <br />
            {unit}
          </span>
        </div>
      </div>
      <div className="flex flex-col tabular-nums">
        <div className="moto-item">
          <span className="moto-thumb" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v11H4zM9 20h6M12 16v4" /></svg>
          </span>
          <div>
            <div className="font-semibold">{planName}</div>
            <div className="text-[13px] text-fg3">{planIncludes(order)} · {billed}</div>
          </div>
          <div className="text-right font-semibold">{cents(recurringCents)}</div>
        </div>
        {onboardingCents > 0 && (
          <div className="moto-item">
            <span className="moto-thumb" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>
            </span>
            <div>
              <div className="font-semibold">Onboarding</div>
              <div className="text-[13px] text-fg3">One-time fee</div>
            </div>
            <div className="text-right font-semibold">{cents(onboardingCents)}</div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2.5 border-t border-[var(--rule)] pt-3.5 tabular-nums">
        <div className="flex justify-between gap-3 text-fg2"><span>Subtotal</span><span>{cents(amountCents)}</span></div>
        <div className="flex justify-between gap-3 border-t border-[var(--rule)] pt-3 text-base font-bold">
          <span>Total due today</span>
          <span>{cents(amountCents)}</span>
        </div>
        <div className="text-[13px] text-fg3">
          Then {cents(recurringCents)} per {unit}{nextPaymentAt != null ? `, starting ${longDate(nextPaymentAt)}` : ''}.
        </div>
      </div>
    </div>
  );
}

function CardCheckout({
  order,
  preview,
  cardField,
  cardReady,
  termsVersion,
  busy,
  needsLink,
  error,
  onSubscribe,
  onDifferentCard,
  onUseLink,
}: {
  order: OperatorOrder;
  preview: ChargePreview;
  /** Stripe's card field, when the card is typed here rather than on the Dashboard. */
  cardField: React.ReactNode;
  cardReady: boolean;
  termsVersion: string | null;
  busy: boolean;
  needsLink: boolean;
  error: string | null;
  onSubscribe: () => void;
  onDifferentCard: () => void;
  onUseLink: () => void;
}) {
  const card = preview.card;
  const stripeDisagrees = preview.stripeAmountCents !== preview.amountCents;

  return (
    <div className="moto-checkout -m-6">
      <OrderSummary
        order={order}
        recurringCents={preview.recurringCents}
        amountCents={preview.amountCents}
        period={preview.period}
        nextPaymentAt={preview.nextPaymentAt}
      />

      <div className="moto-payside">
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold">Contact information</h3>
          <div className="moto-box"><div><span className="moto-k">Email</span><span>{order.client.email}</span></div></div>
        </div>
        {cardField ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-[15px] font-semibold">Card information</h3>
            {cardField}
          </div>
        ) : card ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-[15px] font-semibold">Payment method</h3>
            <div className="moto-box">
              <div>
                <span className="moto-radio" aria-hidden="true" />
                <span className="moto-brand" aria-hidden="true">{card.brand.toUpperCase().slice(0, 4)}</span>
                <span>{cardName(card.brand)} •••• {card.last4}</span>
                <span className="ml-auto text-xs font-semibold" style={{ color: 'var(--ok)' }}>Card added</span>
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold">Billing details</h3>
          <div className="moto-box">
            <div><span className="moto-k">Name</span><span>{order.client.legalName}</span></div>
            <div><span className="moto-k">Address</span><span>{order.client.address}</span></div>
          </div>
        </div>
        <div className="moto-check">
          <span className="moto-cb" aria-hidden="true">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <span>
            You agreed to the Juneau Digital Designs Terms of Service{termsVersion ? ` (${termsVersion})` : ''} by phone today. A copy
            was emailed to you.
          </span>
        </div>
        {stripeDisagrees && (
          <div className="text-[13px]" style={{ color: 'var(--danger)' }}>
            Stripe&apos;s price doesn&apos;t match this order, so payment is blocked. Check the plan prices in Stripe.
          </div>
        )}
        <button type="button" className="btn btn-primary w-full py-[15px] text-base" disabled={busy || stripeDisagrees || !cardReady} onClick={onSubscribe}>
          {busy ? 'Processing…' : 'Subscribe'}
        </button>
        <p className="m-0 text-center text-xs text-fg3">
          By subscribing, you allow Juneau Digital Designs to charge your card for this payment and for future payments under the
          Terms of Service. You can cancel any time.
        </p>
        <div className="flex items-center justify-center gap-1.5 text-xs text-fg3">
          <LockIcon size={12} />
          Payments processed securely by Stripe
        </div>
        <ErrorLine text={error} />
        <div className="flex flex-wrap justify-center gap-[18px]">
          {!cardField && (
            <button type="button" className="btn moto-quiet" disabled={busy} onClick={onDifferentCard}>
              Use a different card
            </button>
          )}
          <button type="button" className={`btn ${needsLink ? '' : 'moto-quiet'}`} disabled={busy} onClick={onUseLink}>
            Send a payment link instead
          </button>
        </div>
      </div>
    </div>
  );
}

function CardPaid({
  order,
  preview,
  paid,
}: {
  order: OperatorOrder;
  preview: ChargePreview | null;
  paid: { receipt: ChargeReceipt | null; statementDescriptor: string | null };
}) {
  const r = paid.receipt;
  const amount = r?.amountPaidCents ?? preview?.amountCents ?? null;
  const paidAt = r?.paidAt ?? Date.now();
  const card = r?.card ?? preview?.card ?? null;
  const nextAt = r?.nextPaymentAt ?? preview?.nextPaymentAt ?? null;
  const nextAmount = r?.nextAmountCents ?? preview?.recurringCents ?? null;
  const planName = order.plan.charAt(0).toUpperCase() + order.plan.slice(1);
  const firstName = order.client.contactName.split(/\s+/)[0];

  return (
    <div className="moto-confirm -m-6">
      <div className="moto-receipt moto-play">
        <div className="moto-seal" aria-hidden="true">
          <span className="moto-halo" />
          <svg viewBox="0 0 76 76"><circle className="moto-ring" cx="38" cy="38" r="34" /></svg>
          <svg viewBox="0 0 76 76"><path className="moto-tick" d="M24 39l9 9 19-20" /></svg>
        </div>
        <div className="moto-rise">
          <h2 className="font-display text-[40px] font-bold leading-none">Payment received</h2>
          <p className="m-0 mt-1.5 text-fg2">Thanks, {firstName}. You&apos;re subscribed to {planName}.</p>
        </div>
        <div className="moto-slip moto-rise tabular-nums">
          <div className="flex items-baseline justify-between border-b border-dashed border-[var(--rule)] pb-2.5">
            <span className="text-[13px] text-fg3">Amount paid</span>
            <b className="font-display text-[30px] font-bold leading-none">{amount != null ? cents(amount) : '—'}</b>
          </div>
          <div className="moto-row"><span>Date</span><span>{longDate(paidAt)}</span></div>
          {card && <div className="moto-row"><span>Payment method</span><span>{cardName(card.brand)} •••• {card.last4}</span></div>}
          {r?.invoiceNumber && <div className="moto-row"><span>Receipt</span><span>#{r.invoiceNumber}</span></div>}
          {nextAt != null && nextAmount != null && (
            <div className="moto-row"><span>Next payment</span><span>{cents(nextAmount)} on {longDate(nextAt)}</span></div>
          )}
        </div>
        <p className="moto-rise m-0 text-[13px] text-fg3">
          A receipt is on its way to {order.client.email}.
          {paid.statementDescriptor && (
            <>
              <br />
              The charge appears on your statement as {paid.statementDescriptor}.
            </>
          )}
        </p>
        <span className="moto-rise inline-flex items-center gap-2 text-[13px] text-fg3">
          <span className="moto-spin" aria-hidden="true" />
          Setting up your account…
        </span>
      </div>
    </div>
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
