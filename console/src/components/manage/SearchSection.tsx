'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Circle, XCircle } from '@phosphor-icons/react';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';
import { SC } from '@/lib/searchConsoleCopy';

/**
 * /manage › Search (L11, L12, Phase 3). Two cards:
 *
 *   - Google Search Console: JDD verifies this site's live address itself, submits the sitemap
 *     and adds the client's Google account (POST /api/manage/search-console/verify). A custom
 *     domain attached later is a new address that needs its own setup.
 *   - Proposed pages: the nightly job's proposals. Approve, Not now, Ask the client for facts
 *     (POST /api/manage/search-console/decide). Approving only lists a spoke for the Studio; it
 *     still needs facts, copy, review and an export. Nothing here publishes a page.
 *
 * Every visible string is in lib/searchConsoleCopy.ts, approved word for word (W1–W59).
 */

type StepName = 'token' | 'file' | 'verify' | 'list' | 'sitemap' | 'owner';
interface Step {
  name: StepName;
  ok: boolean;
}
interface Proposal {
  id: string;
  kind: 'spoke' | 'ask-client' | 'town-facts' | 'fold';
  town: string;
  service?: string;
  status: 'open' | 'approved' | 'declined' | 'asked';
  missing?: Array<'shared-facts' | 'service-page'>;
  evidence: {
    impressions: number;
    clicks: number;
    queries: Array<{ query: string; impressions: number; clicks: number; position: number }>;
    signal?: { calls: number; leads: number };
  };
}
interface Data {
  property: string | null;
  verifiedAt: string | null;
  proposals: Proposal[];
  services: Array<{ slug: string; name: string }>;
  sharedFacts: Record<string, number>;
}
type Decision = 'approved' | 'declined' | 'asked';

const STEP_ORDER: StepName[] = ['token', 'file', 'verify', 'list', 'sitemap', 'owner'];

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'off' | 'danger'; children: React.ReactNode }) {
  const color = tone === 'off' ? 'var(--fg-3)' : `var(--${tone})`;
  return (
    <span
      className="mono rounded-full px-2 py-1 text-2xs tracking-wide"
      style={{ color, background: tone === 'off' ? 'var(--rule-weak)' : `var(--${tone}-glow)` }}
    >
      {children}
    </span>
  );
}

/** The live address as a URL-prefix property: `https://<host>/`. */
function propertyOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return `https://${new URL(url).hostname.toLowerCase()}/`;
  } catch {
    return null;
  }
}

export default function SearchSection() {
  const { ctx, site, domains } = useManage();
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [owner, setOwner] = useState('');
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<{ steps: Step[]; error: string | null } | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [decideError, setDecideError] = useState<Record<string, string>>({});

  const qs = `slug=${encodeURIComponent(ctx.slug)}&site=${encodeURIComponent(site.slug)}`;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/manage/search-console/proposals?${qs}`, { cache: 'no-store' });
      const body = (await res.json()) as Partial<Data> & { error?: string };
      if (!res.ok) return setLoadError(body.error ?? String(res.status));
      setData({
        property: body.property ?? null,
        verifiedAt: body.verifiedAt ?? null,
        proposals: body.proposals ?? [],
        services: body.services ?? [],
        sharedFacts: body.sharedFacts ?? {},
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [qs]);

  useEffect(() => {
    setData(null);
    setRun(null);
    setDecided({});
    void load();
  }, [load]);

  async function setUp() {
    setRunning(true);
    setRun(null);
    try {
      const res = await fetch('/api/manage/search-console/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, site: site.slug, ownerEmail: owner.trim() || undefined }),
      });
      const body = (await res.json()) as { steps?: Step[]; error?: string };
      setRun({ steps: body.steps ?? [], error: res.ok ? null : (body.error ?? String(res.status)) });
      if (res.ok) await load();
    } catch (err) {
      setRun({ steps: [], error: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunning(false);
    }
  }

  async function decide(p: Proposal, decision: Decision) {
    setBusy(p.id);
    setDecideError((e) => ({ ...e, [p.id]: '' }));
    try {
      const res = await fetch('/api/manage/search-console/decide', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, site: site.slug, id: p.id, decision }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) setDecideError((e) => ({ ...e, [p.id]: body.error ?? String(res.status) }));
      else setDecided((d) => ({ ...d, [p.id]: decision }));
    } catch (err) {
      setDecideError((e) => ({ ...e, [p.id]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(null);
    }
  }

  const live = domains.source === 'custom' || domains.source === 'vercel-alias' ? propertyOf(domains.liveUrl) : null;
  const serviceName = (slug?: string) => data?.services.find((s) => s.slug === slug)?.name ?? slug ?? '';
  const stopped = run !== null && run.error !== null;
  const state: 'loading' | 'set-up' | 'not-set-up' | 'new-address' | 'stopped' =
    data === null ? 'loading' : stopped ? 'stopped' : !data.property ? 'not-set-up' : live && live !== data.property ? 'new-address' : 'set-up';

  const shownSteps: Array<{ name: StepName; mark: 'ok' | 'fail' | 'wait' }> = run
    ? (() => {
        const failedAt = run.steps.findIndex((s) => !s.ok);
        const seen = run.steps.map((s) => ({ name: s.name, mark: (s.ok ? 'ok' : 'fail') as 'ok' | 'fail' }));
        if (failedAt < 0) return seen;
        const next = STEP_ORDER[STEP_ORDER.indexOf(run.steps[failedAt].name) + 1];
        return next ? [...seen, { name: next, mark: 'wait' as const }] : seen;
      })()
    : [];

  const open = (data?.proposals ?? []).filter((p) => p.status === 'open' || decided[p.id]);

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader title={SC.section} />

      {loadError && (
        <p role="alert" className="mb-4 text-sm" style={{ color: 'var(--danger)' }}>
          {loadError}
        </p>
      )}

      {/* ── Google Search Console ─────────────────────────────────────────── */}
      {state !== 'loading' && data && (
        <section className="panel mb-4 flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">{SC.title}</h2>
            {state === 'set-up' && <Pill tone="ok">{SC.pill.setUp}</Pill>}
            {state === 'not-set-up' && <Pill tone="off">{SC.pill.notSetUp}</Pill>}
            {state === 'new-address' && <Pill tone="warn">{SC.pill.newAddress}</Pill>}
            {state === 'stopped' && <Pill tone="danger">{SC.pill.stopped}</Pill>}
          </div>

          {state === 'set-up' && data.property && data.verifiedAt && (
            <p className="m-0 text-sm text-fg">{SC.setUpFor(data.property, new Date(data.verifiedAt))}</p>
          )}
          {state === 'not-set-up' && <p className="m-0 text-sm text-fg">{SC.notSetUp}</p>}
          {state === 'new-address' && live && data.property && (
            <p className="m-0 text-sm text-fg">{SC.newAddress(live, data.property)}</p>
          )}

          {shownSteps.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-fg2">
              {shownSteps.map((s) => (
                <li key={s.name} className="flex items-center gap-2">
                  {s.mark === 'ok' ? (
                    <CheckCircle size={14} weight="fill" style={{ color: 'var(--ok)' }} />
                  ) : s.mark === 'fail' ? (
                    <XCircle size={14} weight="fill" style={{ color: 'var(--danger)' }} />
                  ) : (
                    <Circle size={14} style={{ color: 'var(--fg-3)' }} />
                  )}
                  {SC.steps[s.name]}
                </li>
              ))}
            </ul>
          )}
          {run?.error && (
            <p role="alert" className="m-0 text-sm" style={{ color: 'var(--danger)' }}>
              {run.error}
            </p>
          )}

          {state !== 'stopped' && (
            <label className="flex max-w-[360px] flex-col gap-1" htmlFor="gsc-owner">
              <span className="field-label">{SC.ownerLabel}</span>
              <input
                id="gsc-owner"
                type="email"
                className="input w-full"
                value={owner}
                placeholder={SC.ownerPlaceholder}
                onChange={(e) => setOwner(e.target.value)}
                disabled={running}
              />
              <span className="text-xs text-fg3">{SC.ownerHelp}</span>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {state === 'set-up' ? (
              <>
                <button type="button" className="btn" onClick={() => void setUp()} disabled={running}>
                  {SC.rerunButton}
                </button>
                <span className="text-xs text-fg3">{SC.rerunHint}</span>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => void setUp()} disabled={running}>
                {SC.setUpButton}
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── Proposed pages ────────────────────────────────────────────────── */}
      {data && (
        <section className="panel mb-4 flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">{SC.proposalsTitle}</h2>
            {open.length > 0 && <span className="text-xs text-fg3">{SC.proposalsHint}</span>}
          </div>
          {open.length === 0 && <p className="m-0 text-sm text-fg3">{SC.proposalsEmpty}</p>}

          {open.map((p, i) => {
            const service = serviceName(p.service);
            const done = decided[p.id];
            const heading =
              p.kind === 'town-facts' ? SC.townHeading(p.town) : p.kind === 'fold' ? SC.foldHeading(service, p.town) : SC.spokeHeading(service, p.town);
            const evidence =
              p.kind === 'town-facts'
                ? SC.evidenceTown(p.evidence.impressions, p.town)
                : p.kind === 'fold'
                  ? SC.evidenceFold(p.evidence.impressions)
                  : SC.evidence(p.evidence.impressions, p.evidence.clicks);
            const signal = p.evidence.signal ? ` ${SC.signal(p.town, p.evidence.signal.calls, p.evidence.signal.leads)}` : '';
            return (
              <div key={p.id} className={`flex flex-col gap-2 ${i > 0 ? 'border-t border-rule pt-4' : ''}`}>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="m-0 text-base font-semibold text-fg">{heading}</h3>
                  {done === 'approved' ? (
                    <Pill tone="ok">{SC.approvedPill}</Pill>
                  ) : (
                    <Pill tone={p.kind === 'spoke' ? 'ok' : p.kind === 'fold' ? 'off' : 'warn'}>{SC.kind[p.kind]}</Pill>
                  )}
                </div>

                {done ? (
                  <p className="m-0 text-sm text-fg">
                    {done === 'approved'
                      ? p.kind === 'fold'
                        ? SC.approvedFold(service, p.town)
                        : SC.approved(service, p.town)
                      : done === 'asked'
                        ? SC.asked
                        : SC.setAside}
                  </p>
                ) : (
                  <>
                    <p className="m-0 text-xs text-fg3">
                      {evidence}
                      {signal}
                    </p>
                    {p.evidence.queries.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] border-collapse text-xs">
                          <thead>
                            <tr>
                              {SC.table.map((h, i) => (
                                <th key={h} className={`mono border-b border-rule px-2 py-1 text-2xs font-medium uppercase tracking-wide text-fg3 ${i ? 'text-right' : 'text-left'}`}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {p.evidence.queries.map((q) => (
                              <tr key={q.query}>
                                <td className="border-b border-rule px-2 py-1 text-fg2">{q.query}</td>
                                <td className="mono border-b border-rule px-2 py-1 text-right tabular-nums">{q.impressions}</td>
                                <td className="mono border-b border-rule px-2 py-1 text-right tabular-nums">{q.clicks}</td>
                                <td className="mono border-b border-rule px-2 py-1 text-right tabular-nums">{q.position.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {p.kind === 'ask-client' && p.missing?.includes('shared-facts') && (
                      <p className="m-0 text-sm text-fg">
                        {SC.missingFacts(p.town, service, data.sharedFacts[`${p.town}|${p.service}`] ?? 0)}
                      </p>
                    )}
                    {p.kind === 'ask-client' && p.missing?.includes('service-page') && (
                      <p className="m-0 text-sm text-fg">{SC.missingPage(service)}</p>
                    )}
                    {p.kind === 'town-facts' && <p className="m-0 text-sm text-fg">{SC.townFacts(p.town)}</p>}
                    {p.kind === 'fold' && <p className="m-0 text-sm text-fg">{SC.foldBody(p.town)}</p>}
                    {decideError[p.id] && (
                      <p role="alert" className="m-0 text-sm" style={{ color: 'var(--danger)' }}>
                        {decideError[p.id]}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {p.kind === 'spoke' || p.kind === 'fold' ? (
                        <button type="button" className="btn btn-primary" disabled={busy === p.id} onClick={() => void decide(p, 'approved')}>
                          {SC.approve}
                        </button>
                      ) : (
                        <button type="button" className="btn btn-primary" disabled={busy === p.id} onClick={() => void decide(p, 'asked')}>
                          {SC.ask}
                        </button>
                      )}
                      <button type="button" className="btn" disabled={busy === p.id} onClick={() => void decide(p, 'declined')}>
                        {SC.notNow}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
