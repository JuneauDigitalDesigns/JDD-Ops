'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { MagnifyingGlass, SpinnerGap, Warning } from '@phosphor-icons/react';
import type { Orphan, OrphansPayload } from '@/app/api/orphans/route';

/**
 * Vendor resources with no client behind them.
 *
 * Read-only, with no delete action anywhere on it — deliberately. Real client teardown is
 * unscripted on purpose so a paying customer can't be removed by accident, and a page whose
 * entire premise is "these look unclaimed" is exactly the wrong place to add a shortcut
 * past that. Everything here is a candidate to go and check, not a verdict.
 *
 * Not swept automatically either: it lists whole vendor accounts, which is the most
 * expensive thing the console can do.
 */

const VENDOR_LABEL: Record<Orphan['vendor'], string> = {
  vercel: 'Vercel',
  retell: 'Retell',
  twilio: 'Twilio',
  stripe: 'Stripe',
};

export default function OrphansPage() {
  const [data, setData] = useState<OrphansPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/orphans', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) setError(body?.error ?? `Failed (${res.status})`);
      else setData(body as OrphansPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const monthly = (data?.orphans ?? []).reduce((sum, o) => sum + (o.costCents ?? 0), 0);

  return (
    <div className="onboard-chrome h-full overflow-y-auto">
      <div className="dotfield" aria-hidden />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
        <header className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tightish text-fg">Orphans</h1>
            <p className="meta">
              Vendor resources no client on this machine claims. Candidates to check, not to delete.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn btn-xs">Briefing</Link>
            <button type="button" className="btn btn-xs" onClick={scan} disabled={loading}>
              {loading ? <SpinnerGap size={12} className="animate-spin" /> : <MagnifyingGlass size={12} />}
              {loading ? 'Scanning…' : 'Scan vendors'}
            </button>
          </div>
        </header>

        {error && <p className="meta" style={{ color: 'var(--danger)' }}>{error}</p>}

        {!data && !loading && (
          <p className="meta">
            Nothing scanned yet. This lists entire vendor accounts, so it only runs when you ask.
          </p>
        )}

        {data && (
          <>
            {/* Named before the results: a short list means little if half the vendors
                couldn't be reached, and the count alone wouldn't say so. */}
            {data.unchecked.length > 0 && (
              <section className="panel flex flex-col gap-1 p-4">
                <p className="text-[13px]" style={{ color: 'var(--warn)' }}>
                  {data.unchecked.length} vendor{data.unchecked.length === 1 ? '' : 's'} could not be
                  listed — orphans there are unknown, not absent.
                </p>
                {data.unchecked.map((u) => (
                  <p key={u.vendor} className="meta">
                    {VENDOR_LABEL[u.vendor as Orphan['vendor']] ?? u.vendor} — {u.reason}
                  </p>
                ))}
              </section>
            )}

            <section className="panel flex flex-col gap-3 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">
                  {data.orphans.length} unclaimed
                </h2>
                {data.ignored > 0 && (
                  <span className="meta">{data.ignored} ignored</span>
                )}
                {monthly > 0 && (
                  <span className="meta">
                    ~${(monthly / 100).toFixed(2)}/mo of known recurring cost
                  </span>
                )}
              </div>

              {data.orphans.length === 0 ? (
                <p className="meta">
                  Every resource the reachable vendors reported is claimed by a client folder.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {data.orphans.map((o) => (
                    <li
                      key={`${o.vendor}:${o.id}`}
                      className="flex items-start gap-2.5 border-b py-2.5 last:border-b-0"
                      style={{ borderColor: 'var(--rule)' }}
                    >
                      <Warning size={13} style={{ color: 'var(--warn)', marginTop: 3, flexShrink: 0 }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px]" style={{ color: 'var(--fg-1)' }}>
                          <span className="meta">{VENDOR_LABEL[o.vendor]}</span> {o.label}
                        </p>
                        <p className="meta mt-0.5">{o.note}</p>
                      </div>
                      <span className="meta shrink-0 font-mono">{o.id}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="meta">
              A resource can look unclaimed simply because its client lives on another machine.
              Confirm before removing anything, and remove it in the vendor’s own console —
              there is no delete here on purpose.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
