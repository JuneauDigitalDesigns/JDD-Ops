import Link from 'next/link';
import { readArchiveIndex, type ArchiveStatus } from '@/lib/archive';
import { PLAN_LABEL } from '@/lib/runbook-content';
import PageHeader from '@/components/shell/PageHeader';

/**
 * Every torn-down client, newest first. Read-only, and deliberately a plain server
 * component — unlike the client index this has no live state to poll (a record never
 * changes once its run finishes), so there's nothing a client component would buy here.
 *
 * No icon components here on purpose: every Phosphor usage elsewhere in this codebase is
 * inside a 'use client' file, so a status dot in plain CSS keeps this page's server-only
 * status unambiguous rather than being the first place that gets tested.
 */
export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<ArchiveStatus, string> = {
  complete: 'var(--ok)',
  partial: 'var(--warn)',
  'in-progress': 'var(--fg-3)',
};

export default function ArchivePage() {
  const entries = readArchiveIndex({ limit: 500 });

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 py-8 md:px-8">
      <PageHeader
        title="Archive"
        lede="Torn-down clients. Each record is gitignored, local to this machine — same trust model as clients/ itself."
      />

      {entries.length === 0 ? (
        <p className="py-16 text-center text-xs text-fg3">Nothing torn down yet.</p>
      ) : (
        <div className="panel flex flex-col">
          {entries.map((e) => (
            <Link
              key={e.id}
              href={`/archive/${e.id}`}
              className="flex items-center gap-3 border-b border-rule px-4 py-3 text-xs last:border-b-0 hover:bg-[var(--fg-hover,rgba(255,255,255,0.03))]"
            >
              <span
                className="h-[8px] w-[8px] shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[e.status] }}
                title={e.status}
              />
              <span className="min-w-0 flex-1 truncate text-fg2">{e.brandName}</span>
              <span className="mono shrink-0 text-2xs text-fg3">{e.slug}</span>
              <span className="meta shrink-0">{PLAN_LABEL[e.plan]}</span>
              <span className="meta shrink-0 w-[110px] text-right">
                {new Date(e.archivedAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
