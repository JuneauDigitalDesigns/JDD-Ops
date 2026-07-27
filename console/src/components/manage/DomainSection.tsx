'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowSquareOut,
  ArrowsClockwise,
  CheckCircle,
  Info,
  Plus,
  SpinnerGap,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import CopyButton from '@/components/CopyButton';
import { useManage, type DomainEntry } from './ManageContext';
import SectionHeader from './SectionHeader';

/**
 * Where this site actually serves, and how to point a real domain at it.
 *
 * Exists because the console used to answer "what's the URL?" from `seo.canonical`, which
 * is a preset placeholder until a human replaces it — so a healthy client showed as down
 * and "Open site" opened a domain the client never owned.
 *
 * The DNS targets below are Vercel's documented values. They're shown as guidance next to
 * what the domain currently resolves to, rather than being asserted as the only valid
 * setup, because Vercel also accepts nameserver delegation.
 */
const VERCEL_A_RECORD = '76.76.21.21';
const VERCEL_CNAME = 'cname.vercel-dns.com';

const SOURCE_LABEL: Record<string, string> = {
  custom: 'your custom domain',
  'vercel-alias': 'the Vercel alias',
  canonical: 'site.ts — Vercel could not be reached, so this is unverified',
  none: 'nothing resolved',
};

export default function DomainSection() {
  const { ctx, site, domains, refreshDomains } = useManage();
  const [http, setHttp] = useState<{ loading: boolean; status: number | null; ok: boolean }>({
    loading: false,
    status: null,
    ok: false,
  });

  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [canonicalBusy, setCanonicalBusy] = useState(false);
  const [canonicalResult, setCanonicalResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Probed server-side: a browser fetch of the client's site would be blocked by CORS, and
  // the endpoint takes a slug rather than a URL so it can't be used to fetch anything else.
  const probe = useCallback(async () => {
    setHttp({ loading: true, status: null, ok: false });
    try {
      const qs = new URLSearchParams({ slug: ctx.slug, site: site.slug });
      const res = await fetch(`/api/manage/probe?${qs.toString()}`, { cache: 'no-store' });
      const body = (await res.json()) as { ok?: boolean; status?: number | null };
      setHttp({ loading: false, status: body.status ?? null, ok: Boolean(body.ok) });
    } catch {
      setHttp({ loading: false, status: null, ok: false });
    }
  }, [ctx.slug, site.slug]);

  useEffect(() => {
    if (domains.liveUrl) void probe();
  }, [domains.liveUrl, probe]);

  async function addDomain() {
    const domain = input.trim();
    if (!domain) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch('/api/manage/domains', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, site: site.slug, domain }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (body.error) setAddError(body.error);
      else {
        setInput('');
        await refreshDomains();
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Add failed.');
    } finally {
      setAdding(false);
    }
  }

  async function setCanonical() {
    if (!domains.liveUrl) return;
    setCanonicalBusy(true);
    setCanonicalResult(null);
    try {
      const res = await fetch('/api/manage/canonical', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, site: site.slug, canonical: domains.liveUrl }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        canonical?: string;
        kv?: { ok: boolean; email?: string; note?: string };
      };
      if (body.error) {
        setCanonicalResult({ ok: false, text: body.error });
      } else {
        setCanonicalResult({
          ok: true,
          text: `site.ts now says ${body.canonical}. ${
            body.kv?.ok ? `Portal record (${body.kv.email}) updated too.` : (body.kv?.note ?? '')
          }`,
        });
        await refreshDomains();
      }
    } catch (err) {
      setCanonicalResult({ ok: false, text: err instanceof Error ? err.message : 'Failed.' });
    } finally {
      setCanonicalBusy(false);
    }
  }

  const canonicalMatches =
    domains.canonical && domains.liveUrl
      ? domains.canonical.replace(/\/$/, '') === domains.liveUrl.replace(/\/$/, '')
      : false;

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader
        title="Domain"
        lede="Resolved from Vercel — what the project actually serves, not what site.ts claims."
        actions={
          <button type="button" onClick={() => void refreshDomains()} className="btn btn-sm">
            <ArrowsClockwise size={13} className={domains.loading ? 'animate-spin' : undefined} />
            Refresh
          </button>
        }
      />

      {/* ── 1. Serving now ─────────────────────────────────────────────────── */}
      <section className="panel mb-4 flex flex-col gap-3 p-5">
        <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Serving now</h2>

        {domains.loading ? (
          <p className="text-xs text-fg3">Asking Vercel…</p>
        ) : domains.liveUrl ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={domains.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 font-mono text-sm text-fg transition-colors hover:text-accent"
              >
                {domains.liveUrl.replace(/^https?:\/\//, '')} <ArrowSquareOut size={13} />
              </a>
              {http.loading ? (
                <SpinnerGap size={14} className="animate-spin text-fg3" />
              ) : http.status !== null ? (
                <span
                  className={http.ok ? 'badge badge-ok' : 'badge badge-danger'}
                  title={`HTTP ${http.status}`}
                >
                  <span className="dot" />
                  {http.status}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-fg3">
              Resolved from {SOURCE_LABEL[domains.source] ?? domains.source}.
            </p>
          </>
        ) : (
          <p className="text-xs text-fg3">
            {domains.reason ?? 'No domain resolved — the Vercel project may not exist yet.'}
          </p>
        )}
      </section>

      {/* ── 2. Attached domains ────────────────────────────────────────────── */}
      <section className="panel mb-4 flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">
            Attached to Vercel
          </h2>
          <p className="text-xs text-fg3">
            Every project keeps its <code className="codechip">.vercel.app</code> alias. A custom
            domain also needs DNS pointed at Vercel before it will serve.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <span className="field-label !mb-0">Add a custom domain</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addDomain()}
              disabled={adding}
              placeholder="clientdomain.com"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            onClick={() => void addDomain()}
            disabled={adding || !input.trim()}
            className="btn btn-primary btn-sm"
          >
            {adding ? <SpinnerGap size={13} className="animate-spin" /> : <Plus size={13} />}
            Attach
          </button>
        </div>

        {addError && (
          <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--danger)' }}>
            <XCircle size={14} weight="fill" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{addError}</span>
          </div>
        )}

        {domains.domains.length === 0 && !domains.loading && (
          <p className="text-xs text-fg3">{domains.reason ?? 'No domains on this project.'}</p>
        )}

        {domains.domains.map((d) => (
          <DomainRow key={d.name} domain={d} slug={ctx.slug} siteSlug={site.slug} onChanged={refreshDomains} />
        ))}
      </section>

      {/* ── 3. Canonical ───────────────────────────────────────────────────── */}
      <section className="panel flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">
            Canonical URL
          </h2>
          <p className="text-xs text-fg3">
            What the deployed site tells search engines about itself — its metadata, sitemap,
            robots.txt and structured data.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Row label="site.ts says">
            <span className="font-mono">{domains.canonical ?? <span className="text-fg3">not set</span>}</span>
          </Row>
          <Row label="Actually serves">
            <span className="font-mono">{domains.liveUrl ?? <span className="text-fg3">unknown</span>}</span>
          </Row>
        </div>

        {!domains.loading && domains.liveUrl && !canonicalMatches && (
          <>
            <div
              className="flex items-start gap-2 rounded-[8px] border p-2.5 text-xs"
              style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)', color: 'var(--fg-2)' }}
            >
              <Warning size={14} weight="fill" style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }} />
              <span>
                These disagree, so the live site is advertising a URL it doesn&apos;t serve from.
                {domains.canonical?.includes('your') && ' That value looks like an unreplaced preset placeholder.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void setCanonical()}
              disabled={canonicalBusy}
              className="btn btn-primary btn-sm self-start"
            >
              {canonicalBusy && <SpinnerGap size={13} className="animate-spin" />}
              Set canonical to {domains.liveUrl.replace(/^https?:\/\//, '')}
            </button>
          </>
        )}

        {canonicalMatches && (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ok)' }}>
            <CheckCircle size={13} weight="fill" /> site.ts matches what serves.
          </span>
        )}

        {canonicalResult && (
          <div
            className="flex items-start gap-2 text-xs"
            style={{ color: canonicalResult.ok ? undefined : 'var(--danger)' }}
          >
            {canonicalResult.ok ? (
              <CheckCircle size={14} weight="fill" style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 2 }} />
            ) : (
              <XCircle size={14} weight="fill" style={{ flexShrink: 0, marginTop: 2 }} />
            )}
            <span className={canonicalResult.ok ? 'text-fg2' : undefined}>{canonicalResult.text}</span>
          </div>
        )}

        <div
          className="flex items-start gap-2 rounded-[8px] border p-2.5 text-xs"
          style={{ borderColor: 'var(--rule)', background: 'var(--bg-deep)', color: 'var(--fg-3)' }}
        >
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            Writing the canonical updates <code className="codechip">clients/{ctx.slug}/site.ts</code>{' '}
            and the portal account record. The deployed site keeps the old value until you re-export
            this client from Build and redeploy — the repo carries its own copy.
          </span>
        </div>
      </section>
    </div>
  );
}

/** One attached domain, expanding into DNS guidance when it isn't verified yet. */
function DomainRow({
  domain,
  slug,
  siteSlug,
  onChanged,
}: {
  domain: DomainEntry;
  slug: string;
  siteSlug: string;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const isAlias = domain.name.endsWith('.vercel.app');
  const isApex = domain.apexName === domain.name;

  async function recheck() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/manage/domains/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, site: siteSlug, domain: domain.name }),
      });
      const body = (await res.json()) as { verified?: boolean; reason?: string };
      if (body.verified) await onChanged();
      else setResult(body.reason ?? 'Still not verified — DNS may not have propagated yet.');
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Re-check failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-rule pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-fg">{domain.name}</span>
        {domain.verified ? (
          <span className="badge badge-ok">
            <span className="dot" />
            verified
          </span>
        ) : (
          <span className="badge badge-warn">
            <span className="dot" />
            pending DNS
          </span>
        )}
        {isAlias && <span className="text-xs text-fg3">Vercel alias — always available</span>}
        {domain.redirect && <span className="text-xs text-fg3">redirects to {domain.redirect}</span>}
        {!domain.verified && (
          <button type="button" onClick={recheck} disabled={busy} className="btn btn-xs ml-auto">
            {busy ? <SpinnerGap size={11} className="animate-spin" /> : <ArrowsClockwise size={11} />}
            Re-check
          </button>
        )}
      </div>

      {!domain.verified && (
        <div
          className="flex flex-col gap-2 rounded-[8px] border p-2.5"
          style={{ borderColor: 'var(--rule)', background: 'var(--bg-deep)' }}
        >
          <span className="kicker">Add this at your registrar</span>
          <DnsRecord
            type={isApex ? 'A' : 'CNAME'}
            name={isApex ? '@' : domain.name.split('.')[0]}
            value={isApex ? VERCEL_A_RECORD : VERCEL_CNAME}
          />

          {domain.verification.map((v) => (
            <DnsRecord key={`${v.type}-${v.value}`} type={v.type} name={v.domain} value={v.value} note="ownership check" />
          ))}

          {domain.config && (
            <div className="flex flex-col gap-1 border-t border-rule pt-2 text-xs text-fg3">
              <span>
                Currently:{' '}
                {domain.config.configuredBy
                  ? `pointed at Vercel via ${domain.config.configuredBy}`
                  : 'not pointed at Vercel yet'}
              </span>
              {domain.config.aValues.length > 0 && (
                <span className="font-mono">A → {domain.config.aValues.join(', ')}</span>
              )}
              {domain.config.nameservers.length > 0 && (
                <span className="font-mono">NS → {domain.config.nameservers.join(', ')}</span>
              )}
            </div>
          )}

          {result && (
            <span className="text-xs" style={{ color: 'var(--warn)' }}>
              {result}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DnsRecord({
  type,
  name,
  value,
  note,
}: {
  type: string;
  name: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="w-[52px] shrink-0 font-mono text-fg2">{type}</span>
      <span className="w-[90px] shrink-0 truncate font-mono text-fg3" title={name}>
        {name}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-fg" title={value}>
        {value}
      </span>
      {/* label="" keeps this an icon-only button — the default renders "Copy" text, which
          is too heavy for a dense record row. */}
      <CopyButton value={value} label="" />
      {note && <span className="text-fg3">{note}</span>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-xs">
      <span className="w-[110px] shrink-0 text-fg3">{label}</span>
      <span className="min-w-0 flex-1 truncate text-fg2">{children}</span>
    </div>
  );
}
