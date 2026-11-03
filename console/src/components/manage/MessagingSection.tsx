'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowClockwise, CheckCircle, Circle, Lock, SpinnerGap, Warning, XCircle } from '@phosphor-icons/react';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';
import A2pCloseWizard, { type CloseWizardPrefill } from './A2pCloseWizard';
import type {
  A2pBatchStepResult,
  A2pEnums,
  A2pIntakeRecord,
  A2pRegistrationRecord,
  ReadinessCheck,
  StepAvailability,
  StepDef,
  StoredEvaluation,
} from '@/lib/a2pChain';

/**
 * Messaging & A2P — the operator-driven per-client 10DLC registration
 * (PLAN-console-a2p-registration.md).
 *
 * A stepper derived entirely from the registration record: the server computes which step is
 * legal (`availability` in lib/a2p-register.js) and this renders it, so the UI can never offer
 * a step the server would refuse.
 *
 * ── Things this component must keep true ─────────────────────────────────────────────────────
 *   - **Every Twilio write opens the confirm dialog — always, in every environment.** It does
 *     NOT use `useManage().confirmWrite`, which resolves at once in the test environment: the
 *     Twilio account is the same real account either way, and decision 3 is that nothing reaches
 *     it without an explicit click. Filing steps also require the slug typed back.
 *   - **Sensitive values live only in this step's form state** and are cleared the moment the
 *     request settles, success or failure: the EIN, the rep's details, the sole proprietor's
 *     mobile. Nothing is written to localStorage, and nothing is ever read back from Twilio.
 *     A correction that needs the EIN again means retyping it.
 *   - **The enums arrive as props** from the server component; there is no copy of them here.
 */

type Path = 'standard' | 'sole-proprietor';

interface SectionData {
  plan: string;
  registers: boolean;
  record: A2pRegistrationRecord | null;
  steps: StepDef[];
  availability: Record<string, StepAvailability>;
  portalStatus: string;
  intake: A2pIntakeRecord | null;
  intakeMissing: string[];
  numbers: Record<string, string>;
  masterServiceSid: string | null;
  brandName: string;
  error?: string;
}

interface Readiness {
  ok: true | false | null;
  checks: ReadinessCheck[];
  error?: string;
}

/** Keys cleared from a form after its request settles. */
const SENSITIVE = new Set(['ein', 'firstName', 'lastName', 'email', 'phone', 'mobile']);
/** Steps that file with Twilio: a review clock or a fee. Mirrors FILING_STEPS in the route. */
const FILING = new Set(['profile.submit', 'trust.submit', 'brand.register', 'campaign.create']);

/** What each write does, in words the confirm dialog shows. */
const EFFECT: Record<string, (d: SectionData, f: Record<string, any>) => string> = {
  'profile.create': (_d, f) => `Creates a ${f.registrationPath === 'sole-proprietor' ? 'Starter' : 'Secondary'} customer profile on JDD's Twilio account. Free, stays in draft.`,
  'business.create': () => 'Creates the business-information EndUser. The EIN is sent to Twilio in this one request and is not kept anywhere by JDD.',
  'business.update': () => 'Updates only the business fields you changed on the existing EndUser. The EIN is not resent.',
  'rep.create': () => 'Creates the representative EndUser. Their name, email and phone are sent to Twilio in this one request and not kept by JDD.',
  'rep.update': () => 'Updates only the representative’s job position / title on the existing EndUser. Their name, email and phone are not resent.',
  'address.create': () => 'Creates a Twilio Address and the supporting document that wraps it.',
  'profile.attach': () => "Attaches every identity object to the profile — including JDD's primary profile, which declares the ISV relationship.",
  'profile.evaluate': () => 'Runs a free compliance evaluation. Files nothing.',
  'profile.submit': () => 'SUBMITS the customer profile to Twilio for review. This starts the review clock and cannot be withdrawn.',
  'trust.create': (d) => `Creates the A2P trust product, its EndUser${d.record?.registrationPath === 'sole-proprietor' ? ' (with the owner’s mobile, where the carrier OTP will land — not kept by JDD)' : ''}, and attaches the customer profile.`,
  'trust.evaluate': () => 'Runs a free compliance evaluation of the trust product. Files nothing.',
  'trust.submit': () => 'SUBMITS the trust product to Twilio for review.',
  'brand.register': (_d, f) =>
    f.mock
      ? 'Registers a MOCK brand. It moves through real status transitions and can never send. Twilio does not document whether mock brands are billed.'
      : 'Registers a REAL brand with The Campaign Registry. This incurs the registration fee and starts a 3–5 business day review that cannot be undone.',
  'brand.otp': () => "Asks Twilio to resend the carrier OTP to the owner's mobile.",
  'service.create': () => "Creates this client's own Messaging Service, wired to the agency's inbound SMS webhook.",
  'campaign.create': () => 'Creates the campaign. This SUBMITS it to carrier review (10–15 business days) and incurs fees.',
  'number.attach': (_d, f) =>
    f.moveFromMaster
      ? `Removes ${f.siteSlug}'s number from JDD's master Messaging Service and adds it to this client's service.`
      : `Adds ${f.siteSlug}'s number to this client's Messaging Service, then reads it back.`,
};

/** The /manage section: the panel, with the client taken from the manage context. */
export default function MessagingSection({ enums }: { enums: A2pEnums }) {
  const { ctx } = useManage();
  return <A2pRegistrationPanel slug={ctx.slug} enums={enums} />;
}

/**
 * The whole registration stepper for one client, with no dependency on /manage.
 *
 * Exported so another console flow (the sales-call wizard) can EMBED it rather than build a
 * second EIN form — two places that take an EIN are two places to get zero-retention wrong.
 * `embedded` drops the page header and width; everything else, the confirm dialog included,
 * is identical. The host must pass `enums` from a server component (`loadA2pEnums()`).
 */
export function A2pRegistrationPanel(props: {
  slug: string;
  enums: A2pEnums;
  embedded?: boolean;
  /**
   * `close-wizard` — the sales-call close's SMS step: one form, one typed-slug confirm, a
   * three-item checklist (A2pCloseWizard.tsx). Same chain, same retention rules.
   */
  variant?: 'stepper' | 'close-wizard';
  prefill?: CloseWizardPrefill;
  vertical?: string;
  onResult?: (result: { ok: boolean; results: A2pBatchStepResult[] }) => void;
}) {
  if (props.variant === 'close-wizard') {
    return <A2pCloseWizard slug={props.slug} enums={props.enums} prefill={props.prefill} vertical={props.vertical} onResult={props.onResult} />;
  }
  return <A2pStepper slug={props.slug} enums={props.enums} embedded={props.embedded} />;
}

function A2pStepper({ slug, enums, embedded = false }: { slug: string; enums: A2pEnums; embedded?: boolean }) {
  const ctx = { slug };
  const Shell = embedded ? EmbeddedShell : PageShell;
  const [data, setData] = useState<SectionData | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [forms, setForms] = useState<Record<string, Record<string, any>>>({});
  const [confirm, setConfirm] = useState<{ step: string; label: string; effect: string; filing: boolean } | null>(null);
  const [typed, setTyped] = useState('');
  const [intakeDraft, setIntakeDraft] = useState<A2pIntakeRecord>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, r] = await Promise.all([
        fetch(`/api/manage/a2p?slug=${encodeURIComponent(ctx.slug)}`, { cache: 'no-store' }).then((res) => res.json() as Promise<SectionData>),
        fetch('/api/manage/a2p/readiness', { cache: 'no-store' }).then((res) => res.json() as Promise<Readiness>),
      ]);
      setData(a);
      setReadiness(r);
      setIntakeDraft(a.intake ?? {});
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Could not load.' });
    } finally {
      setLoading(false);
    }
  }, [ctx.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const path: Path = (data?.record?.registrationPath ?? forms['profile.create']?.registrationPath ?? 'standard') as Path;
  const ready = readiness?.ok === true;

  // Defaults the forms start from: the intake (client-supplied, operator-corrected) and the brand.
  const defaults = useMemo<Record<string, Record<string, any>>>(() => {
    const i = data?.intake ?? {};
    return {
      'profile.create': { registrationPath: 'standard' },
      'business.create': { legalBusinessName: i.legalBusinessName ?? '', businessType: i.businessType ?? '', businessIndustry: '', websiteUrl: i.websiteUrl ?? '', ein: '' },
      'business.update': { legalBusinessName: '', businessType: '', businessIndustry: '', websiteUrl: '' },
      'rep.create': { firstName: '', lastName: '', email: '', phone: '', jobPosition: '', businessTitle: '' },
      'rep.update': { jobPosition: '', businessTitle: '' },
      'address.create': {
        customerName: i.legalBusinessName ?? '',
        street: i.address?.street ?? '',
        city: i.address?.city ?? '',
        region: i.address?.region ?? '',
        postalCode: i.address?.postalCode ?? '',
        country: i.address?.country ?? 'US',
      },
      'trust.create': { companyType: 'private', brandContactEmail: '', brandName: data?.brandName ?? '', mobile: '', vertical: '' },
      'brand.register': { mock: true },
      'service.create': { friendlyName: `${data?.brandName ?? ctx.slug} — ${ctx.slug}` },
      'campaign.create': {
        usecase: 'CUSTOMER_CARE',
        description: '',
        messageFlow: '',
        messageSamples: ['', '', ''],
        hasEmbeddedLinks: true,
        hasEmbeddedPhone: true,
        optInMessage: '',
        optOutMessage: '',
        helpMessage: '',
      },
    };
  }, [data?.intake, data?.brandName, ctx.slug]);

  const form = (step: string) => ({ ...(defaults[step] ?? {}), ...(forms[step] ?? {}) });
  const setField = (step: string, key: string, value: unknown) =>
    setForms((prev) => ({ ...prev, [step]: { ...form(step), ...(prev[step] ?? {}), [key]: value } }));

  function ask(step: string, extra: Record<string, unknown> = {}) {
    if (!data) return;
    const def = data.steps.find((s) => s.id === step);
    const values = { ...form(step), ...extra };
    if (Object.keys(extra).length) setForms((prev) => ({ ...prev, [step]: values }));
    setTyped('');
    setConfirm({
      step,
      label: def?.label ?? step,
      effect: (EFFECT[step] ?? (() => 'Writes to Twilio.'))(data, values),
      filing: FILING.has(step),
    });
  }

  async function run(step: string, write: boolean) {
    setConfirm(null);
    setBusy(step);
    setResult(null);
    const input = step === 'status.refresh' ? {} : form(step);
    try {
      const res = await fetch(`/api/manage/a2p/${encodeURIComponent(step)}?slug=${encodeURIComponent(ctx.slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input, confirm: write ? true : undefined, confirmSlug: write ? typed : undefined }),
      });
      const body = (await res.json()) as { ok?: boolean; summary?: string; error?: string; portal?: Array<{ site: string; ok: boolean; note?: string }> };
      const portalNote = (body.portal ?? []).filter((p) => !p.ok).map((p) => `${p.site}: ${p.note}`).join(' ');
      setResult(body.ok ? { ok: true, text: `${body.summary}${portalNote ? ` Portal: ${portalNote}` : ''}` } : { ok: false, text: body.error ?? 'Step failed.' });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Request failed.' });
    } finally {
      // Clear every sensitive value the moment the request settles — success or failure.
      setForms((prev) => {
        const next = { ...prev };
        if (next[step]) next[step] = Object.fromEntries(Object.entries(next[step]).filter(([k]) => !SENSITIVE.has(k)));
        return next;
      });
      setTyped('');
      setBusy(null);
      await load();
    }
  }

  async function saveIntake() {
    setBusy('intake');
    setResult(null);
    try {
      const res = await fetch(`/api/manage/a2p?slug=${encodeURIComponent(ctx.slug)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ intake: intakeDraft }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      setResult(body.ok ? { ok: true, text: 'Intake corrections saved.' } : { ok: false, text: body.error ?? 'Save failed.' });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) {
    return (
      <Shell>
        <p className="text-sm" style={{ color: 'var(--fg-2)' }}>
          <SpinnerGap size={14} className="mr-2 inline animate-spin" />
          Reading the registration record and Phase 0 readiness…
        </p>
      </Shell>
    );
  }
  if (!data || data.error) {
    return (
      <Shell>
        <Notice tone="danger" text={data?.error ?? result?.text ?? 'Could not load.'} />
      </Shell>
    );
  }

  const r = data.record;
  const visibleSteps = data.steps.filter((s) => !s.path || s.path === path);

  return (
    <Shell
      actions={
        <button type="button" className="btn btn-sm" onClick={() => void run('status.refresh', false)} disabled={!r || busy !== null}>
          {busy === 'status.refresh' ? <SpinnerGap size={13} className="animate-spin" /> : <ArrowClockwise size={13} />}
          Refresh status
        </button>
      }
    >
      {result && <Notice tone={result.ok ? 'ok' : 'danger'} text={result.text} />}

      <ReadinessPanel readiness={readiness} />

      <section className="mt-6 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Stat k="Path" v={r ? (r.registrationPath === 'sole-proprietor' ? 'Sole proprietor' : 'Standard (Low-Volume)') : 'not chosen'} />
        <Stat k="Brand" v={r?.brandSid ? `${r.statuses?.brand ?? '?'}${r.mock ? ' · MOCK' : ''}` : '—'} warn={r?.mock} />
        <Stat k="Campaign" v={r?.statuses?.campaign ?? '—'} />
        <Stat k="Portal shows" v={data.portalStatus} />
      </section>
      {r?.statuses?.refreshedAt && (
        <p className="mt-2 text-xs" style={{ color: 'var(--fg-3)' }}>
          Last refreshed {new Date(r.statuses.refreshedAt).toLocaleString()}. No poller runs — refresh by hand (plan decision 2).
        </p>
      )}

      <IntakeCard
        enums={enums}
        draft={intakeDraft}
        setDraft={setIntakeDraft}
        missing={data.intakeMissing}
        onSave={() => void saveIntake()}
        busy={busy === 'intake'}
      />

      <ol className="mt-8 space-y-3">
        {visibleSteps.map((step) => {
          const a = data.availability[step.id] ?? { done: false, enabled: false };
          const blocked = !ready && step.write;
          return (
            <li key={step.id} className="rounded-lg border p-4" style={{ borderColor: a.enabled && !blocked ? 'var(--rule-strong)' : 'var(--rule)', background: 'var(--panel)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5">
                    {a.done ? <CheckCircle size={16} weight="fill" style={{ color: 'var(--ok)' }} /> : blocked || !a.enabled ? <Lock size={16} style={{ color: 'var(--fg-3)' }} /> : <Circle size={16} style={{ color: 'var(--accent)' }} />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      <span className="mr-2 font-mono text-xs" style={{ color: 'var(--fg-3)' }}>{step.runbook}</span>
                      {step.label}
                    </p>
                    <StepFacts step={step.id} record={r} />
                    {!a.done && (a.reason || blocked) && (
                      <p className="mt-1 text-xs" style={{ color: 'var(--fg-3)' }}>
                        {blocked ? 'Blocked until Phase 0 readiness passes.' : a.reason}
                      </p>
                    )}
                  </div>
                </div>
                {step.id !== 'status.refresh' && step.id !== 'number.attach' && (
                  <button type="button" className="btn btn-sm" disabled={!a.enabled || blocked || busy !== null} onClick={() => ask(step.id)}>
                    {busy === step.id ? <SpinnerGap size={13} className="animate-spin" /> : null}
                    {FILING.has(step.id) ? 'File…' : 'Run…'}
                  </button>
                )}
              </div>
              {a.enabled && !blocked && (
                <StepForm
                  step={step.id}
                  path={path}
                  plan={data.plan}
                  enums={enums}
                  values={form(step.id)}
                  set={(k, v) => setField(step.id, k, v)}
                />
              )}
              {step.id === 'number.attach' && r?.messagingServiceSid && (
                <NumberRows
                  data={data}
                  disabled={blocked || busy !== null}
                  onAttach={(siteSlug, moveFromMaster) => ask('number.attach', { siteSlug, moveFromMaster })}
                />
              )}
              {step.id === 'profile.evaluate' && r?.lastEvaluation && <EvaluationView evaluation={r.lastEvaluation} />}
              {step.id === 'trust.evaluate' && r?.lastTrustEvaluation && <EvaluationView evaluation={r.lastTrustEvaluation} />}
              {step.id === 'brand.register' && (r?.errors?.brand?.length ?? 0) > 0 && <ErrorList items={r!.errors!.brand!} />}
              {step.id === 'campaign.create' && (r?.errors?.campaign?.length ?? 0) > 0 && <ErrorList items={r!.errors!.campaign!} />}
            </li>
          );
        })}
      </ol>

      {confirm && (
        <ConfirmDialog
          slug={ctx.slug}
          request={confirm}
          typed={typed}
          setTyped={setTyped}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void run(confirm.step, true)}
        />
      )}
    </Shell>
  );
}

function EmbeddedShell({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="w-full">
      {actions && <div className="mb-3 flex justify-end">{actions}</div>}
      {children}
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────────────────────

function PageShell({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader
        title="Messaging & A2P"
        lede="This client’s own carrier registration: profile → trust product → brand → campaign → number. Every Twilio write is a click you confirm."
        actions={actions}
      />
      {children}
    </div>
  );
}

function Notice({ tone, text }: { tone: 'ok' | 'danger' | 'warn'; text: string }) {
  const color = tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : 'var(--danger)';
  const Icon = tone === 'ok' ? CheckCircle : tone === 'warn' ? Warning : XCircle;
  return (
    <p className="mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm" style={{ borderColor: color }}>
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color }} />
      <span>{text}</span>
    </p>
  );
}

function Stat({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="rounded-md border px-3 py-2" style={{ borderColor: warn ? 'var(--warn)' : 'var(--rule)' }}>
      <p className="text-[11px] uppercase" style={{ color: 'var(--fg-3)', letterSpacing: 'var(--tracking-widest)' }}>{k}</p>
      <p className="mt-0.5 font-mono text-xs">{v}</p>
    </div>
  );
}

function ReadinessPanel({ readiness }: { readiness: Readiness | null }) {
  if (!readiness) return null;
  if (readiness.ok === true) {
    return <Notice tone="ok" text="Phase 0 ready — JDD's primary profile is an approved ISV reseller and both chain policies resolve." />;
  }
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--danger)' }}>
      <p className="text-sm font-semibold">Phase 0 is not ready — every Twilio write below is blocked, here and on the server.</p>
      {readiness.error && <p className="mt-1 text-xs">{readiness.error}</p>}
      <ul className="mt-3 space-y-2 text-xs">
        {readiness.checks.filter((c) => c.ok !== true).map((c) => (
          <li key={c.id}>
            <span className="font-semibold">{c.ok === null ? '? ' : '✕ '}{c.label}</span> — {c.detail}
            {c.fix && <span style={{ color: 'var(--fg-2)' }}> → {c.fix}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function IntakeCard({
  enums,
  draft,
  setDraft,
  missing,
  onSave,
  busy,
}: {
  enums: A2pEnums;
  draft: A2pIntakeRecord;
  setDraft: (d: A2pIntakeRecord) => void;
  missing: string[];
  onSave: () => void;
  busy: boolean;
}) {
  const addr = draft.address ?? {};
  const setAddr = (k: string, v: string) => setDraft({ ...draft, address: { ...addr, [k]: v } });
  return (
    <section className="mt-8 rounded-lg border p-4" style={{ borderColor: 'var(--rule)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Business registration details</p>
        <button type="button" className="btn btn-sm" onClick={onSave} disabled={busy}>
          {busy ? <SpinnerGap size={13} className="animate-spin" /> : null}Save corrections
        </button>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--fg-3)' }}>
        Typed here by you — the client’s onboarding form doesn’t collect these. Saved to the intake record and reused as defaults below. No EIN and no representative details live here.
      </p>
      {missing.length > 0 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--warn)' }}>
          Still to enter: {missing.join('; ')}.
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Legal business name (IRS record, exactly)" value={draft.legalBusinessName ?? ''} onChange={(v) => setDraft({ ...draft, legalBusinessName: v })} />
        <Select label="Business type" value={draft.businessType ?? ''} options={enums.businessTypes} onChange={(v) => setDraft({ ...draft, businessType: v })} />
        <Field label="Website" value={draft.websiteUrl ?? ''} onChange={(v) => setDraft({ ...draft, websiteUrl: v })} />
        <Field label="Street" value={addr.street ?? ''} onChange={(v) => setAddr('street', v)} />
        <Field label="City" value={addr.city ?? ''} onChange={(v) => setAddr('city', v)} />
        <Field label="State" value={addr.region ?? ''} onChange={(v) => setAddr('region', v)} />
        <Field label="ZIP" value={addr.postalCode ?? ''} onChange={(v) => setAddr('postalCode', v)} />
        <Field label="Country" value={addr.country ?? ''} onChange={(v) => setAddr('country', v)} />
      </div>
    </section>
  );
}

function StepFacts({ step, record: r }: { step: string; record: A2pRegistrationRecord | null }) {
  const facts: Array<[string, string | undefined]> = (() => {
    switch (step) {
      case 'profile.create': return [['profile', r?.profileSid], ['status', r?.statuses?.profile]];
      case 'business.create': return [['EndUser', r?.businessEndUserSid]];
      case 'rep.create': return [['EndUser', r?.repEndUserSid]];
      case 'address.create': return [['address', r?.addressSid], ['document', r?.addressDocSid]];
      case 'profile.attach': return [['assignments', r?.profileAssignments ? String(Object.keys(r.profileAssignments).length) : undefined]];
      case 'trust.create': return [['trust product', r?.trustProductSid], ['EndUser', r?.trustEndUserSid], ['status', r?.statuses?.trustProduct]];
      case 'brand.register': return [['brand', r?.brandSid], ['status', r?.statuses?.brand], ['identity', r?.statuses?.brandIdentity]];
      case 'service.create': return [['service', r?.messagingServiceSid]];
      case 'campaign.create': return [['campaign', r?.campaignSid], ['status', r?.statuses?.campaign]];
      default: return [];
    }
  })();
  const shown = facts.filter(([, v]) => v);
  if (!shown.length) return null;
  return (
    <p className="mt-1 font-mono text-xs" style={{ color: 'var(--fg-2)' }}>
      {shown.map(([k, v]) => `${k} ${v}`).join(' · ')}
    </p>
  );
}

function StepForm({
  step,
  path,
  plan,
  enums,
  values: v,
  set,
}: {
  step: string;
  path: Path;
  plan: string;
  enums: A2pEnums;
  values: Record<string, any>;
  set: (key: string, value: unknown) => void;
}) {
  const grid = 'mt-3 grid grid-cols-2 gap-3';
  switch (step) {
    case 'profile.create':
      return (
        <div className="mt-3 space-y-2 text-sm">
          <Radio name="path" checked={v.registrationPath === 'standard'} onChange={() => set('registrationPath', 'standard')} label="Standard — the client has an EIN (Low-Volume Standard, ~$2/mo + $4 once)" />
          <Radio
            name="path"
            checked={v.registrationPath === 'sole-proprietor'}
            disabled={plan === 'enterprise'}
            onChange={() => set('registrationPath', 'sole-proprietor')}
            label={`Sole proprietor — no EIN at all. One number only, and the owner must answer a carrier OTP.${plan === 'enterprise' ? ' Not available for Enterprise.' : ''}`}
          />
          <p className="text-xs" style={{ color: 'var(--fg-3)' }}>Fixed for the life of this registration. Twilio: every US LLC has an EIN, so LLCs are always Standard.</p>
        </div>
      );
    case 'business.create':
    case 'business.update':
      return (
        <div className={grid}>
          <Field label="Legal business name" value={v.legalBusinessName} onChange={(x) => set('legalBusinessName', x)} />
          <Select label="Business type" value={v.businessType} options={enums.businessTypes} onChange={(x) => set('businessType', x)} />
          <Select
            label="Industry (TCR)"
            value={v.businessIndustry}
            options={enums.industries}
            onChange={(x) => set('businessIndustry', x)}
            hint={`Defaults by vertical: ${Object.entries(enums.defaultIndustryByVertical).map(([k, i]) => `${k} → ${i}`).join(', ')}.`}
          />
          <Field label="Website" value={v.websiteUrl} onChange={(x) => set('websiteUrl', x)} />
          {step === 'business.create' && (
            <Field
              label="EIN (NN-NNNNNNN) — sent once, never stored or shown again"
              value={v.ein}
              onChange={(x) => set('ein', x)}
              secret
            />
          )}
        </div>
      );
    case 'rep.create':
      return (
        <div className={grid}>
          <Field label="First name" value={v.firstName} onChange={(x) => set('firstName', x)} secret />
          <Field label="Last name" value={v.lastName} onChange={(x) => set('lastName', x)} secret />
          <Field label="Direct email" value={v.email} onChange={(x) => set('email', x)} secret />
          <Field label="Mobile (+1…)" value={v.phone} onChange={(x) => set('phone', x)} secret />
          {path === 'standard' && (
            <>
              <JobPosition enums={enums} value={v.jobPosition} onChange={(x) => set('jobPosition', x)} />
              <Field label="Business title (free text — “Owner” goes here)" value={v.businessTitle} onChange={(x) => set('businessTitle', x)} />
            </>
          )}
        </div>
      );
    case 'rep.update':
      return (
        <div className={grid}>
          <JobPosition enums={enums} value={v.jobPosition} onChange={(x) => set('jobPosition', x)} />
          <Field label="Business title" value={v.businessTitle} onChange={(x) => set('businessTitle', x)} />
        </div>
      );
    case 'address.create':
      return (
        <div className={grid}>
          {(['customerName', 'street', 'city', 'region', 'postalCode', 'country'] as const).map((k) => (
            <Field key={k} label={k} value={v[k]} onChange={(x) => set(k, x)} />
          ))}
        </div>
      );
    case 'trust.create':
      return path === 'sole-proprietor' ? (
        <div className={grid}>
          <Field label="Brand name" value={v.brandName} onChange={(x) => set('brandName', x)} />
          <Field label="Owner’s own mobile (+1…) — gets the OTP; not a Twilio number" value={v.mobile} onChange={(x) => set('mobile', x)} secret />
          <Select label="Vertical (optional)" value={v.vertical} options={enums.soleProprietorVerticals.map((x) => ({ value: x, label: x }))} onChange={(x) => set('vertical', x)} />
        </div>
      ) : (
        <div className={grid}>
          <Select label="Company type" value={v.companyType} options={enums.companyTypes.map((x) => ({ value: x, label: x }))} onChange={(x) => set('companyType', x)} />
          <Field label="Brand contact email" value={v.brandContactEmail} onChange={(x) => set('brandContactEmail', x)} />
          {v.companyType === 'public' && (
            <>
              <Field label="Stock exchange" value={v.stockExchange ?? ''} onChange={(x) => set('stockExchange', x)} />
              <Field label="Stock ticker" value={v.stockTicker ?? ''} onChange={(x) => set('stockTicker', x)} />
            </>
          )}
        </div>
      );
    case 'brand.register':
      return (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.mock === true} onChange={(e) => set('mock', e.target.checked)} />
          Mock brand (free test registration — cannot send). Untick only for a real filing.
        </label>
      );
    case 'service.create':
      return (
        <div className={grid}>
          <Field label="Friendly name" value={v.friendlyName} onChange={(x) => set('friendlyName', x)} />
        </div>
      );
    case 'campaign.create':
      return (
        <div className="mt-3 space-y-3">
          {path === 'standard' ? (
            <Select label="Use case" value={v.usecase} options={enums.standardUsecases.map((x) => ({ value: x, label: x }))} onChange={(x) => set('usecase', x)} />
          ) : (
            <p className="text-xs" style={{ color: 'var(--fg-3)' }}>Use case: SOLE_PROPRIETOR (the only one Twilio allows on this path).</p>
          )}
          <Area label="Description (40–4096) — what this client will actually send" value={v.description} onChange={(x) => set('description', x)} />
          <Area label="Message flow (40–2048) — quote the web form’s consent disclosure verbatim" value={v.messageFlow} onChange={(x) => set('messageFlow', x)} />
          {(v.messageSamples as string[]).map((s, i) => (
            <Field
              key={i}
              label={`Sample ${i + 1} (20–1024)`}
              value={s}
              onChange={(x) => set('messageSamples', (v.messageSamples as string[]).map((old, j) => (j === i ? x : old)))}
            />
          ))}
          {(v.messageSamples as string[]).length < 5 && (
            <button type="button" className="btn btn-sm" onClick={() => set('messageSamples', [...(v.messageSamples as string[]), ''])}>Add sample</button>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.hasEmbeddedLinks} onChange={(e) => set('hasEmbeddedLinks', e.target.checked)} />Messages contain links (review requests do)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.hasEmbeddedPhone} onChange={(e) => set('hasEmbeddedPhone', e.target.checked)} />Messages contain phone numbers</label>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Opt-in message (optional)" value={v.optInMessage} onChange={(x) => set('optInMessage', x)} />
            <Field label="Opt-out message (optional)" value={v.optOutMessage} onChange={(x) => set('optOutMessage', x)} />
            <Field label="Help message (optional)" value={v.helpMessage} onChange={(x) => set('helpMessage', x)} />
          </div>
        </div>
      );
    default:
      return null;
  }
}

function JobPosition({ enums, value, onChange }: { enums: A2pEnums; value: string; onChange: (v: string) => void }) {
  return (
    <Select
      label="Job position (Twilio enum)"
      value={value}
      options={enums.jobPositions.map((x) => ({ value: x, label: x }))}
      onChange={onChange}
      hint="Twilio rejects “Owner” here. An owner is CEO, or Other."
    />
  );
}

function NumberRows({ data, disabled, onAttach }: { data: SectionData; disabled: boolean; onAttach: (siteSlug: string, moveFromMaster: boolean) => void }) {
  const [move, setMove] = useState<Record<string, boolean>>({});
  const sites = Object.entries(data.numbers);
  if (!sites.length) return <p className="mt-3 text-xs" style={{ color: 'var(--fg-3)' }}>No site has a TWILIO_NUMBER.</p>;
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {sites.map(([site, e164]) => {
        const n = data.record?.numbers?.[site];
        return (
          <li key={site} className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs">
              {site} · {e164} · {n?.inService ? 'in this client’s service (read back)' : n ? 'NOT in service on last check' : 'not attached'}
            </span>
            <span className="flex items-center gap-3">
              {data.masterServiceSid && (
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={move[site] === true} onChange={(e) => setMove({ ...move, [site]: e.target.checked })} />
                  move out of master pool {data.masterServiceSid.slice(0, 8)}…
                </label>
              )}
              <button type="button" className="btn btn-sm" disabled={disabled} onClick={() => onAttach(site, move[site] === true)}>
                {n?.inService ? 'Re-check…' : 'Attach…'}
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function EvaluationView({ evaluation }: { evaluation: StoredEvaluation }) {
  return (
    <div className="mt-3 text-xs">
      <p style={{ color: evaluation.status === 'compliant' ? 'var(--ok)' : 'var(--danger)' }}>
        Last evaluation {evaluation.status} · {new Date(evaluation.at).toLocaleString()} · {evaluation.sid}
      </p>
      {evaluation.failures.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {evaluation.failures.map((f, i) => (
            <li key={i}>
              <span className="font-mono">{f.objectType}{f.field ? `.${f.field}` : ''}</span> — {f.reason || f.requirement}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ErrorList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 list-disc pl-5 text-xs" style={{ color: 'var(--danger)' }}>
      {items.map((e, i) => <li key={i}>{e}</li>)}
    </ul>
  );
}

function ConfirmDialog({
  slug,
  request,
  typed,
  setTyped,
  onCancel,
  onConfirm,
}: {
  slug: string;
  request: { step: string; label: string; effect: string; filing: boolean };
  typed: string;
  setTyped: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  const canGo = !request.filing || typed === slug;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(20, 18, 12, 0.45)' }} onClick={onCancel}>
      <div className="w-full max-w-md rounded-lg border p-5" style={{ background: 'var(--panel)', borderColor: request.filing ? 'var(--danger)' : 'var(--rule-strong)' }} onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] font-semibold uppercase" style={{ letterSpacing: 'var(--tracking-widest)', color: 'var(--warn)' }}>
          Twilio write · live account
        </p>
        <h2 className="mt-2 text-base font-semibold">{request.label}</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--fg-2)' }}>
          Client: <span className="font-mono" style={{ color: 'var(--fg)' }}>{slug}</span>
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--fg-2)' }}>{request.effect}</p>
        {request.filing && (
          <label className="mt-3 block text-xs">
            Type <span className="font-mono">{slug}</span> to file:
            <input className="input mt-1 w-full font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </label>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={!canGo} onClick={onConfirm}>
            {request.filing ? 'File with Twilio' : 'Run'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, secret }: { label: string; value: string; onChange: (v: string) => void; secret?: boolean }) {
  return (
    <label className="block text-xs" style={{ color: 'var(--fg-2)' }}>
      {label}
      <input
        className="input mt-1 w-full"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        // Sensitive inputs: no autofill, no password-manager capture, no spellcheck upload.
        autoComplete="off"
        spellCheck={secret ? false : undefined}
        data-1p-ignore={secret ? true : undefined}
        data-lpignore={secret ? 'true' : undefined}
      />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs" style={{ color: 'var(--fg-2)' }}>
      {label} <span className="font-mono">({(value ?? '').trim().length})</span>
      <textarea className="input mt-1 w-full" rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="block text-xs" style={{ color: 'var(--fg-2)' }}>
      {label}
      <select className="input mt-1 w-full" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <span className="mt-1 block" style={{ color: 'var(--fg-3)' }}>{hint}</span>}
    </label>
  );
}

function Radio({ name, checked, onChange, label, disabled }: { name: string; checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-2" style={{ opacity: disabled ? 0.5 : 1 }}>
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="mt-1" />
      <span>{label}</span>
    </label>
  );
}
