'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle,
  Question,
  SpinnerGap,
  WarningCircle,
  WarningOctagon,
} from '@phosphor-icons/react';
import { severityCounts, type Finding, type Severity } from '@jdd/schema';
import { relativeTime } from '@/lib/relativeTime';

/**
 * What reconcile found, grouped by severity and then by area.
 *
 * Grouped rather than flat because a flat list makes you re-triage every time you open it:
 * the point of the severity model is that you can stop reading after red. Areas are the
 * second key so related problems on one site sit together — a dead Make scenario and a
 * missing Call Log table are one story, not two.
 *
 * `unknown` renders as its own band with a distinct icon, never folded into the healthy
 * state. That is the invariant the whole engine rests on: a check that could not run must
 * not look like a check that passed.
 */

const SEVERITY_META: Record<
  Severity,
  { label: string; Icon: typeof WarningOctagon; color: string; lede: string }
> = {
  red: {
    label: 'Breaking',
    Icon: WarningOctagon,
    color: 'var(--danger)',
    lede: 'Costing money or visible to the client right now.',
  },
  amber: {
    label: 'Drifting',
    Icon: WarningCircle,
    color: 'var(--warn)',
    lede: 'Not broken yet, but moved away from how it was set up.',
  },
  unknown: {
    label: 'Unchecked',
    Icon: Question,
    color: 'var(--fg-3)',
    lede: 'These could not be checked. That is not the same as healthy.',
  },
  grey: {
    label: 'Noted',
    Icon: CheckCircle,
    color: 'var(--fg-3)',
    lede: 'Worth knowing, nothing to do today.',
  },
};

const BAND_ORDER: Severity[] = ['red', 'amber', 'unknown', 'grey'];

export default function FindingsList({
  findings,
  checkedAt,
  unreachable = [],
  onChanged,
}: {
  findings: Finding[];
  checkedAt: number | null;
  unreachable?: string[];
  onChanged?: () => void;
}) {
  const counts = useMemo(() => severityCounts(findings), [findings]);

  const bands = useMemo(
    () =>
      BAND_ORDER.map((severity) => ({
        severity,
        items: findings.filter((f) => f.severity === severity),
      })).filter((b) => b.items.length > 0),
    [findings],
  );

  if (!checkedAt) {
    return (
      <p className="meta">
        Not swept yet. Run a check to see how this client’s infrastructure actually looks.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="meta">
          {findings.length === 0
            ? 'Nothing wrong across every vendor checked.'
            : `${counts.red} breaking · ${counts.amber} drifting · ${counts.unknown} unchecked`}
        </p>
        <span className="meta" title={new Date(checkedAt).toISOString()}>
          checked {relativeTime(new Date(checkedAt).toISOString())}
        </span>
      </div>

      {/* Named separately from the findings: a vendor that went dark explains WHY a band is
          thin, and without it a short list reads as good news. */}
      {unreachable.length > 0 && (
        <p className="meta" style={{ color: 'var(--warn)' }}>
          Could not reach: {unreachable.join(', ')}. Anything they own is unverified.
        </p>
      )}

      {bands.map(({ severity, items }) => (
        <Band key={severity} severity={severity} items={items} onChanged={onChanged} />
      ))}
    </div>
  );
}

function Band({
  severity,
  items,
  onChanged,
}: {
  severity: Severity;
  items: Finding[];
  onChanged?: () => void;
}) {
  const meta = SEVERITY_META[severity];
  const Icon = meta.Icon;

  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-center gap-2 border-b pb-1.5" style={{ borderColor: 'var(--rule)' }}>
        <Icon size={14} weight="fill" style={{ color: meta.color }} />
        <h3 className="text-[13px] font-medium" style={{ color: 'var(--fg-1)' }}>
          {meta.label}
        </h3>
        <span className="meta">{items.length}</span>
        <span className="meta ml-auto hidden sm:inline">{meta.lede}</span>
      </header>

      <ul className="flex flex-col">
        {items.map((f) => (
          <FindingRow key={`${f.siteSlug}:${f.id}`} finding={f} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

function FindingRow({ finding, onChanged }: { finding: Finding; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function applyFix() {
    if (!finding.fix) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(finding.fix.route, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(finding.fix.body),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? `Failed (${res.status})`);
        return;
      }
      setDone(body.changed === false ? 'Already correct.' : 'Fixed.');
      // Undo is NOT offered here. onChanged re-sweeps, the re-sweep clears the finding
      // that was just fixed, and this row unmounts — so an Undo button rendered here would
      // vanish in the same tick it appeared. It lives in <RecentRepairs>, which reads the
      // undo log and therefore outlives both the finding and the sweep.
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-1 border-b py-2.5 last:border-b-0" style={{ borderColor: 'var(--rule)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px]" style={{ color: 'var(--fg-1)' }}>
            {finding.title}
          </p>
          <p className="meta mt-0.5">{finding.detail}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {finding.fix && !done && (
            <button className="btn btn-xs" onClick={applyFix} disabled={busy}>
              {busy ? <SpinnerGap size={12} className="animate-spin" /> : null}
              {finding.fix.label}
            </button>
          )}
          {done && <span className="meta">{done}</span>}
        </div>
      </div>

      {/* Expected/actual only when the check produced both — printing "expected: —" for a
          finding that has no comparison invents a precision the probe didn't have. */}
      {(finding.expected || finding.actual) && (
        <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-0.5">
          {finding.expected && (
            <div className="flex gap-1.5">
              <dt className="meta">expected</dt>
              <dd className="meta font-mono" style={{ color: 'var(--fg-2)' }}>
                {finding.expected}
              </dd>
            </div>
          )}
          {finding.actual && (
            <div className="flex gap-1.5">
              <dt className="meta">actual</dt>
              <dd className="meta font-mono" style={{ color: 'var(--warn)' }}>
                {finding.actual}
              </dd>
            </div>
          )}
        </dl>
      )}

      <span className="meta">{finding.siteSlug}</span>

      {error && (
        <p className="meta" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </li>
  );
}
