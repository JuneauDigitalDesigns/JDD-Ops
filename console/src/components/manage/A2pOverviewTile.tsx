'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChatCircleText, Question } from '@phosphor-icons/react';

/**
 * Overview's one A2P line (plan Phase 1): is Phase 0 ready, and where is this client's
 * registration. Growth/Enterprise only — the caller gates it. Read-only; the work happens in
 * Messaging & A2P, which this links to.
 *
 * `null` readiness renders as "could not check", never as ready.
 */
export default function A2pOverviewTile({ slug }: { slug: string }) {
  const [state, setState] = useState<{ ready: true | false | null; portalStatus: string | null } | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([
      fetch('/api/manage/a2p/readiness', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ ok: null })),
      fetch(`/api/manage/a2p?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
    ]).then(([readiness, data]) => {
      if (live) setState({ ready: readiness?.ok ?? null, portalStatus: data?.portalStatus ?? null });
    });
    return () => {
      live = false;
    };
  }, [slug]);

  const color = !state ? 'var(--fg-3)' : state.ready === false ? 'var(--danger)' : state.ready === null ? 'var(--warn)' : state.portalStatus === 'verified' ? 'var(--ok)' : 'var(--fg-2)';
  const text = !state
    ? 'Checking…'
    : state.ready === false
      ? 'Phase 0 not ready — per-client registration is blocked'
      : state.ready === null
        ? 'Phase 0 could not be checked'
        : `Registration: ${state.portalStatus ?? 'unknown'}`;

  return (
    <Link href={`/c/${slug}/manage/messaging`} className="panel mb-3 flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--surface)]">
      <span style={{ color }}>{state ? <ChatCircleText size={15} weight="fill" /> : <Question size={15} />}</span>
      <span className="text-xs text-fg3">A2P texting</span>
      <span className="text-fg">{text}</span>
    </Link>
  );
}
