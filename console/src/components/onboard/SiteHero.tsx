'use client';
// The deployed site, as the main element of its review step.
//
// The URL is the point of this step, so it is the biggest thing on it — previously the operator
// had to read a context card to learn the Vercel project name, open Vercel, find Deployments,
// find Production, and click Visit. Four hops to reach a URL we can derive.
//
// `vercelAppHost` is IMPORTED, never re-derived. Vercel REMOVES characters that aren't valid in
// a DNS label rather than substituting hyphens, so `e2e_test_growth` serves at
// `e2etestgrowth.vercel.app`. Three call sites once implemented that as `.replace(/_/g,'-')`,
// which pointed underscore-slug clients at a hostname that does not resolve — and nothing
// surfaced, because the number looked configured and the agent looked healthy.
//
// The derivation is best-effort (Vercel appends a hash on collision or overlong labels), which
// is why the card says so rather than presenting it as certain.

import { useState } from 'react';
import { ArrowClockwise, ArrowSquareOut } from '@phosphor-icons/react';
import { vercelAppHost } from '@jdd/schema';
import type { SiteInfo } from '@/lib/types';
import CopyButton from '@/components/CopyButton';

export default function SiteHero({ site }: { site: SiteInfo }) {
  const host = vercelAppHost(site.slug);
  const url = `https://${host}`;
  const [nonce, setNonce] = useState(0);

  return (
    <div className="grid w-full gap-5 lg:grid-cols-2">
      {/* ── the URL itself ─────────────────────────────────────────────── */}
      <div className="flex flex-col justify-center gap-4 rounded-[16px] border border-rule bg-[var(--panel)] p-7">
        <span className="kicker">The live site</span>
        <div className="font-display text-[2.1rem] font-semibold leading-[1.05] tracking-tightish [overflow-wrap:anywhere]">
          <span style={{ color: 'var(--fg-3)', fontWeight: 500 }}>https://</span>
          <span style={{ color: 'var(--accent)' }}>{host.replace(/\.vercel\.app$/, '')}</span>
          <span style={{ color: 'var(--fg-3)', fontWeight: 500 }}>.vercel.app</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="btn btn-primary">
            <ArrowSquareOut size={15} weight="bold" /> Open site
          </a>
          <CopyButton value={url} />
          <button type="button" className="btn btn-sm" onClick={() => setNonce((n) => n + 1)}>
            <ArrowClockwise size={13} /> Reload preview
          </button>
        </div>
        <p className="max-w-[46ch] text-xs leading-[1.55] text-fg3">
          Vercel keeps <code>.vercel.app</code> URLs live permanently, so this stays reachable even
          after a custom domain is attached. The host is derived from the slug — Vercel appends a
          hash on collision or overlong labels, so confirm it opens rather than assuming.
        </p>
      </div>

      {/* ── live preview ───────────────────────────────────────────────── */}
      <div className="flex min-h-[340px] flex-col overflow-hidden rounded-[14px] border border-rule bg-white shadow-[0_20px_50px_-26px_rgba(20,18,12,.4)]">
        <div className="flex shrink-0 items-center gap-2 border-b border-rule bg-[var(--panel-2)] px-3 py-2">
          <span className="h-[9px] w-[9px] rounded-full" style={{ background: '#e4705f' }} />
          <span className="h-[9px] w-[9px] rounded-full" style={{ background: '#e3b341' }} />
          <span className="h-[9px] w-[9px] rounded-full" style={{ background: '#6cbf73' }} />
          <span className="mono flex-1 truncate rounded-full border border-rule bg-white px-3 py-1 text-[10.5px] text-fg2">
            {url}
          </span>
        </div>
        <div className="relative flex-1 bg-white">
          <iframe
            key={nonce}
            src={url}
            title={`${site.brandName} — live preview`}
            className="absolute inset-0 h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
          />
        </div>
        <div className="shrink-0 border-t border-rule px-3 py-1.5">
          <span className="meta">
            Blank frame? The deploy may still be building, or the site sends a framing header — open it in a tab.
          </span>
        </div>
      </div>
    </div>
  );
}
