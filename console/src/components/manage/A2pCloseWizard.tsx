'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Circle, SpinnerGap, XCircle } from '@phosphor-icons/react';
import type { A2pBatchStepResult, A2pEnums, A2pPath, A2pRegistrationRecord } from '@/lib/a2pChain';
import { toE164 } from '@jdd/schema';
import { formWebsite } from '@/lib/a2pFormRules';

/**
 * The sales-call close's SMS step — `<A2pRegistrationPanel variant="close-wizard" />`.
 *
 * Still the ONLY EIN form in the console: this is a second layout of the same panel, posting to
 * the same chain through `POST /api/manage/a2p/batch`, not a second implementation. One typed
 * slug runs the whole filing sequence (operator approval, 2026-11-03). "Add later" saves what
 * needs no EIN; the same button finishes once the client has it.
 *
 * Screen-shared with the client, so there is no operator commentary on screen — labels only.
 *
 * Retention rules, same as the stepper: the EIN, the representative's details and the mobile
 * live only in this component's state and are cleared the moment the request settles, success
 * or failure. Nothing is written to localStorage, nothing is read back from Twilio.
 */

export interface CloseWizardPrefill {
  legalBusinessName?: string;
  websiteUrl?: string;
  repFirstName?: string;
  repLastName?: string;
  repEmail?: string;
  repPhone?: string;
  /** Freeform. Shown beside the address fields, never parsed into them. */
  address?: string;
}

interface Props {
  slug: string;
  enums: A2pEnums;
  prefill?: CloseWizardPrefill;
  /** An INDUSTRY_MENUS id (`hvac`, `plumbing`, …) to preselect the TCR industry from. */
  vertical?: string;
  /** Called after every run with the per-step results, for a host that wants them. */
  onResult?: (result: { ok: boolean; results: A2pBatchStepResult[] }) => void;
}

type Item = 'pending' | 'running' | 'done' | 'failed';

/**
 * The order keeps the phone as the operator typed it, and the registration checks want E.164: on
 * 2026-11-08 a prefilled "(407) 555-0142" came back as "Check: Mobile" on a form nobody had
 * touched. Anything unreadable is left alone, for the check to name.
 */
const formPhone = (raw: string | null | undefined): string => toE164(raw) ?? (raw ?? '');

const FILED = new Set(['pending-review', 'in-review', 'twilio-approved']);

const FIELD_LABELS: Record<string, string> = {
  'business.legalBusinessName': 'Legal business name',
  'business.businessType': 'Business type',
  'business.businessIndustry': 'Industry',
  'business.websiteUrl': 'Website',
  'business.ein': 'EIN',
  'rep.firstName': 'First name',
  'rep.lastName': 'Last name',
  'rep.email': 'Email',
  'rep.phone': 'Mobile',
  'rep.jobPosition': 'Position',
  'address.street': 'Street',
  'address.city': 'City',
  'address.region': 'State',
  'address.postalCode': 'ZIP',
  'address.country': 'Country',
  'address.customerName': 'Legal business name',
  'trust.brandName': 'Business name',
  'trust.mobile': 'Mobile',
  'trust.brandContactEmail': 'Email',
};

export default function A2pCloseWizard({ slug, enums, prefill = {}, vertical, onResult }: Props) {
  const [plan, setPlan] = useState<string | null>(null);
  const [record, setRecord] = useState<A2pRegistrationRecord | null>(null);
  const [path, setPath] = useState<A2pPath>('standard');
  const [einNow, setEinNow] = useState(true);
  const [legalBusinessName, setLegal] = useState(prefill.legalBusinessName ?? '');
  const [businessType, setBusinessType] = useState('');
  const [businessIndustry, setIndustry] = useState(vertical ? enums.defaultIndustryByVertical[vertical] ?? '' : '');
  const [websiteUrl, setWebsite] = useState(prefill.websiteUrl ?? '');
  const [ein, setEin] = useState('');
  const [rep, setRep] = useState({
    firstName: prefill.repFirstName ?? '',
    lastName: prefill.repLastName ?? '',
    jobPosition: '',
    email: prefill.repEmail ?? '',
    phone: formPhone(prefill.repPhone),
  });
  const [address, setAddress] = useState({ street: '', city: '', region: '', postalCode: '', country: 'US' });
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>(['pending', 'pending', 'pending']);
  const [testMode, setTestMode] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/manage/a2p?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
    const body = (await res.json()) as { plan?: string; record?: A2pRegistrationRecord | null; testMode?: boolean };
    setTestMode(Boolean(body.testMode));
    setPlan(body.plan ?? null);
    setRecord(body.record ?? null);
    if (body.record?.registrationPath) setPath(body.record.registrationPath);
    const s = body.record?.statuses ?? {};
    const p = FILED.has(String(s.profile ?? ''));
    const t = FILED.has(String(s.trustProduct ?? ''));
    setItems([p ? 'done' : 'pending', t ? 'done' : 'pending', p && t ? 'done' : 'pending']);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const enterprise = plan === 'enterprise';
  const pathLocked = Boolean(record?.registrationPath);
  const needsEin = path === 'standard' && !record?.businessEndUserSid;
  const addLater = path === 'standard' && needsEin && !einNow;
  const submitted = items[0] === 'done' && items[1] === 'done';

  async function run() {
    setBusy(true);
    setError(null);
    setItems((prev) => prev.map((i) => (i === 'done' ? i : 'pending')) as Item[]);
    if (!addLater) setItems((prev) => [prev[0] === 'done' ? 'done' : 'running', prev[1], prev[2]]);
    // Test mode saves nothing, so re-reading the record afterwards would undo the ticks.
    let keepTicks = false;
    try {
      const res = await fetch(`/api/manage/a2p/batch?slug=${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: addLater ? 'save' : 'submit',
          confirm: true,
          confirmSlug: typed,
          form: {
            registrationPath: path,
            legalBusinessName,
            businessType,
            businessIndustry,
            websiteUrl: formWebsite(websiteUrl),
            ein: addLater ? undefined : ein,
            rep: { ...rep, phone: formPhone(rep.phone), ...(path === 'standard' ? {} : { jobPosition: undefined }) },
            address,
          },
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        invalid?: string[];
        error?: string;
        results?: A2pBatchStepResult[];
        testMode?: boolean;
      };
      keepTicks = Boolean(body.testMode && body.ok);
      const results = body.results ?? [];
      onResult?.({ ok: Boolean(body.ok), results });
      if (body.invalid?.length) {
        setError(`Check: ${body.invalid.map((f) => FIELD_LABELS[f] ?? f).join(', ')}.`);
      } else if (!body.ok) {
        const failed = results.find((r) => r.status === 'failed');
        setError(failed?.error ?? body.error ?? 'Something went wrong.');
      }
      // The person's details are cleared once the batch succeeded; after a failure they stay, so
      // a typo is not a retype of everything while the client watches. They are still never
      // stored anywhere — this component's state is the only copy.
      if (body.ok) setRep((r) => ({ ...r, email: '', phone: '', firstName: '', lastName: '' }));
      await reveal(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      // The EIN is cleared the moment the request settles, success or failure. Retyping it
      // after a failure is the intended cost of zero retention.
      setEin('');
      setTyped('');
      setBusy(false);
      if (!keepTicks) await load();
    }
  }

  /** Tick the checklist one item at a time from the step results. */
  async function reveal(results: A2pBatchStepResult[]) {
    const ok = (step: string) => results.some((r) => r.step === step && (r.status === 'done' || r.status === 'skipped'));
    const failedAt = (steps: string[]) => results.some((r) => steps.includes(r.step) && r.status === 'failed');
    const profileSteps = ['profile.create', 'business.create', 'rep.create', 'address.create', 'profile.attach', 'profile.evaluate', 'profile.submit'];
    const trustSteps = ['trust.create', 'trust.evaluate', 'trust.submit'];
    const wait = () => new Promise((r) => setTimeout(r, 450));
    const first: Item = ok('profile.submit') ? 'done' : failedAt(profileSteps) ? 'failed' : 'pending';
    setItems((p) => [first, p[1], p[2]]);
    if (first !== 'done') return;
    await wait();
    const second: Item = ok('trust.submit') ? 'done' : failedAt(trustSteps) ? 'failed' : 'pending';
    setItems((p) => [p[0], second, p[2]]);
    if (second !== 'done') return;
    await wait();
    setItems(['done', 'done', 'done']);
  }

  const setR = (k: keyof typeof rep, v: string) => setRep((r) => ({ ...r, [k]: v }));
  const setA = (k: keyof typeof address, v: string) => setAddress((a) => ({ ...a, [k]: v }));

  return (
    <div className="space-y-6">
      {testMode && (
        <div role="status" className="rounded-[10px] border px-3.5 py-2.5 text-sm font-semibold" style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
          Test mode: nothing is sent to Twilio or saved.
        </div>
      )}
      <Section title="Registration type">
        <div className="flex flex-wrap gap-2">
          <Chip on={path === 'standard'} disabled={pathLocked} onClick={() => setPath('standard')}>Business with an EIN</Chip>
          <Chip on={path === 'sole-proprietor'} disabled={pathLocked || enterprise} onClick={() => setPath('sole-proprietor')}>Sole proprietor</Chip>
        </div>
      </Section>

      {path === 'standard' && needsEin && (
        <Section title="EIN and website available now?">
          <div className="flex flex-wrap gap-2">
            <Chip on={einNow} onClick={() => setEinNow(true)}>Yes</Chip>
            <Chip on={!einNow} onClick={() => setEinNow(false)}>Add later</Chip>
          </div>
        </Section>
      )}

      <Section title="Business">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label={path === 'standard' ? 'Legal business name' : 'Business name'} value={legalBusinessName} onChange={setLegal} />
          {path === 'standard' && (
            <>
              <Select label="Business type" value={businessType} onChange={setBusinessType} options={enums.businessTypes} />
              <Select label="Industry" value={businessIndustry} onChange={setIndustry} options={enums.industries} />
              {!addLater && <Input label="Website" value={websiteUrl} onChange={setWebsite} />}
              {needsEin && einNow && <Input label="EIN" value={ein} onChange={setEin} placeholder="12-3456789" secret />}
            </>
          )}
        </div>
      </Section>

      <Section title="Authorized representative">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="First name" value={rep.firstName} onChange={(v) => setR('firstName', v)} secret />
          <Input label="Last name" value={rep.lastName} onChange={(v) => setR('lastName', v)} secret />
          {path === 'standard' && (
            <Select
              label="Position"
              value={rep.jobPosition}
              onChange={(v) => setR('jobPosition', v)}
              options={enums.jobPositions.map((x) => ({ value: x, label: x }))}
            />
          )}
          <Input label="Email" value={rep.email} onChange={(v) => setR('email', v)} secret />
          <Input label="Mobile" value={rep.phone} onChange={(v) => setR('phone', v)} placeholder="+1…" secret />
        </div>
      </Section>

      <Section title="Business address">
        {prefill.address && <p className="mb-2 text-xs" style={{ color: 'var(--fg-3)' }}>{prefill.address}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Street" value={address.street} onChange={(v) => setA('street', v)} />
          <Input label="City" value={address.city} onChange={(v) => setA('city', v)} />
          <Input label="State" value={address.region} onChange={(v) => setA('region', v)} />
          <Input label="ZIP" value={address.postalCode} onChange={(v) => setA('postalCode', v)} />
          <Input label="Country" value={address.country} onChange={(v) => setA('country', v)} />
        </div>
      </Section>

      {!submitted && (
        <div className="flex flex-wrap items-end gap-3">
          <Input label={`Type ${slug} to ${addLater ? 'save' : 'submit'}`} value={typed} onChange={setTyped} mono />
          <button type="button" className="btn btn-primary" disabled={busy || typed !== slug} onClick={() => void run()}>
            {busy ? <SpinnerGap size={14} className="animate-spin" /> : null}
            {addLater ? 'Save' : 'Submit registration'}
          </button>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 text-sm" style={{ color: 'var(--danger)' }}>
          <XCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <ul className="space-y-2 text-sm">
        <Check state={items[0]} label="Business profile submitted" />
        <Check state={items[1]} label="Messaging registration submitted" />
        {record?.businessEndUserSid || path === 'sole-proprietor' || !addLater ? (
          <Check state={items[2]} label="Review started" />
        ) : (
          <Check state="pending" label="EIN still needed" />
        )}
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      {children}
    </section>
  );
}

function Chip({ on, disabled, onClick, children }: { on: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-sm"
      style={{
        borderColor: on ? 'var(--accent)' : 'var(--rule)',
        color: on ? 'var(--accent)' : 'var(--fg-2)',
        opacity: disabled && !on ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  secret,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  mono?: boolean;
}) {
  return (
    <label className="block text-xs" style={{ color: 'var(--fg-2)' }}>
      {label}
      <input
        className={`input mt-1 w-full${mono ? ' font-mono' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={secret ? false : undefined}
        data-1p-ignore={secret ? true : undefined}
        data-lpignore={secret ? 'true' : undefined}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-xs" style={{ color: 'var(--fg-2)' }}>
      {label}
      <select className="input mt-1 w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Check({ state, label }: { state: Item; label: string }) {
  const Icon = state === 'done' ? CheckCircle : state === 'failed' ? XCircle : state === 'running' ? SpinnerGap : Circle;
  const color = state === 'done' ? 'var(--ok)' : state === 'failed' ? 'var(--danger)' : 'var(--fg-3)';
  return (
    <li className="flex items-center gap-2">
      <Icon size={16} weight={state === 'done' ? 'fill' : 'regular'} className={state === 'running' ? 'animate-spin' : undefined} style={{ color }} />
      <span style={{ color: state === 'pending' ? 'var(--fg-3)' : 'var(--fg)' }}>{label}</span>
    </li>
  );
}
