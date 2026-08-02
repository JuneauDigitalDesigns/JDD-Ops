'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Flask, LinkSimple, Play, Warning, XCircle } from '@phosphor-icons/react';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';

/**
 * Which portal account this client signs in with, and repair for when that link is wrong.
 *
 * Single-client now: the old tool was a multi-select across every client, which made sense
 * when /manage was a list of tools and makes none when the client is the route. The dry-run
 * toggle survives — this writes a KV account record, and previewing before writing is
 * genuinely useful.
 */

interface PortalSite {
  slug: string;
  name: string;
  plan: string;
  status: string;
  airtableBaseId: string | null;
  mine: boolean;
}

interface PortalState {
  configured: boolean;
  clerkUserId: string | null;
  email: string | null;
  sites: PortalSite[];
  note?: string;
  error?: string;
}

interface AttachResult {
  ok?: boolean;
  dryRun?: boolean;
  email?: string;
  error?: string;
  results?: Array<{ slug: string; ok: boolean; attached?: string[]; sitesOnAccount?: number; error?: string }>;
}

export default function PortalSection() {
  const { ctx } = useManage();
  const [state, setState] = useState<PortalState | null>(null);
  const [email, setEmail] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AttachResult | null>(null);

  const load = useCallback(async () => {
    setState(null);
    try {
      const res = await fetch(`/api/manage/portal?slug=${encodeURIComponent(ctx.slug)}`, {
        cache: 'no-store',
      });
      const body = (await res.json()) as PortalState;
      setState(body);
      // Prefill with the linked account so "repair" is usually one click.
      if (body.email) setEmail((prev) => prev || body.email!);
    } catch (err) {
      setState({
        configured: false,
        clerkUserId: null,
        email: null,
        sites: [],
        error: err instanceof Error ? err.message : 'Failed to read the portal account.',
      });
    }
  }, [ctx.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function attach() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/manage/link-portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, email: email.trim(), dryRun }),
      });
      const body = (await res.json()) as AttachResult;
      setResult(body);
      if (body.ok && !body.dryRun) await load();
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Attach failed.' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader
        title="Portal"
        lede="The account this client signs into the portal with, and the sites attached to it."
      />

      {/* ── Current state ─────────────────────────────────────────────────── */}
      <section className="panel mb-4 flex flex-col gap-3 p-5">
        <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Current link</h2>

        {state === null && <p className="text-xs text-fg3">Reading the account record…</p>}

        {state?.error && (
          <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
            <Warning size={14} /> {state.error}
          </span>
        )}

        {state && !state.error && (
          <>
            <div className="flex flex-col gap-1.5">
              <Row label="Account">
                {state.email ? (
                  <span className="text-fg">{state.email}</span>
                ) : (
                  <span className="text-fg3">not linked</span>
                )}
              </Row>
              <Row label="Clerk user">
                <span className="font-mono text-xs">
                  {state.clerkUserId ?? <span className="text-fg3">none on disk</span>}
                </span>
              </Row>
            </div>

            {state.note && <p className="text-xs text-fg3">{state.note}</p>}

            {state.sites.length > 0 && (
              <div className="mt-1 flex flex-col gap-1 border-t border-rule pt-3">
                <span className="kicker">Sites on this account</span>
                {state.sites.map((s) => (
                  <div key={s.slug} className="flex items-center gap-2 py-1 text-xs">
                    <span
                      className="h-[6px] w-[6px] shrink-0 rounded-full"
                      style={{ background: s.status === 'live' ? 'var(--ok)' : 'var(--warn)' }}
                    />
                    <span className={s.mine ? 'text-fg' : 'text-fg3'}>{s.name}</span>
                    <span className="font-mono text-fg3">{s.slug}</span>
                    {!s.mine && <span className="text-fg3">· another client</span>}
                    {s.airtableBaseId && (
                      <span className="ml-auto font-mono text-fg3">{s.airtableBaseId}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Repair ────────────────────────────────────────────────────────── */}
      <section className="panel flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tightish text-fg">
            <LinkSimple size={16} weight="fill" style={{ color: 'var(--accent)' }} />
            Attach or repair
          </h2>
          <p className="text-xs text-fg3">
            Writes this client&apos;s {ctx.sites.length} site
            {ctx.sites.length === 1 ? '' : 's'} onto the portal account record. Existing sites on
            that account are preserved.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="field-label !mb-0">Account email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={running}
            placeholder="The email the client signed up to the portal with"
            spellCheck={false}
          />
        </label>

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

          <button
            type="button"
            onClick={attach}
            disabled={!emailValid || running}
            className={dryRun ? 'btn btn-sm' : 'btn btn-primary btn-sm'}
          >
            <Play size={13} weight="fill" />
            {running ? 'Working…' : dryRun ? 'Preview (dry run)' : 'Attach to account'}
          </button>
        </div>

        {result && (
          <div className="flex flex-col gap-2 rounded-[10px] border border-rule p-3" style={{ background: 'var(--bg-deep)' }}>
            {result.error && (
              <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
                <XCircle size={14} weight="fill" /> {result.error}
              </span>
            )}
            {result.results?.map((r) => (
              <div key={r.slug} className="flex items-start gap-2 text-xs">
                {r.ok ? (
                  <CheckCircle size={14} weight="fill" style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <XCircle size={14} weight="fill" style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                )}
                <span className="text-fg2">
                  {r.ok ? (
                    <>
                      {result.dryRun ? 'Would attach' : 'Attached'} {r.attached?.join(', ')}
                      {typeof r.sitesOnAccount === 'number' && (
                        <span className="text-fg3">
                          {' '}
                          ({r.sitesOnAccount} site{r.sitesOnAccount === 1 ? '' : 's'} now on {result.email})
                        </span>
                      )}
                    </>
                  ) : (
                    r.error
                  )}
                </span>
              </div>
            ))}
            {result.ok && result.dryRun && (
              <span className="text-xs text-fg3">Dry run clean — flip the toggle off to write.</span>
            )}
            {result.ok && !result.dryRun && (
              <span className="text-xs text-fg3">
                Done. Have the client reload /portal (or sign in again).
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-xs">
      <span className="w-[90px] shrink-0 text-fg3">{label}</span>
      <span className="min-w-0 flex-1 truncate text-fg2">{children}</span>
    </div>
  );
}
