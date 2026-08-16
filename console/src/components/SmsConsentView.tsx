'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleNotch, MagnifyingGlass } from '@phosphor-icons/react';
import PageHeader from '@/components/shell/PageHeader';
import NavSlot from '@/components/NavSlot';

/**
 * Consent proof lookup.
 *
 * This screen exists for one moment: a carrier, a client, or a regulator asks why a number
 * received texts, and the answer has to be the record exactly as stored. So it renders the
 * event log verbatim and adds nothing — no derived "status" of its own, no tidying of the
 * timestamps into something friendlier than what was written down.
 *
 * Read-only, and it stays that way. Editing a consent log from a console with no auth
 * would make every row in it worth less.
 */

interface ConsentEvent {
    id: string;
    phone: string;
    action: 'granted' | 'revoked' | 'confirmed';
    source: string;
    occurredAt: string;
    ip: string;
    userAgent: string;
    consentTextHash: string;
    consentTextVersion: string;
    agreementId?: string;
    accountEmail?: string;
}

interface ConsentState {
    phone: string;
    status: 'granted' | 'revoked' | 'pending-confirmation';
    updatedAt: string;
    accountEmail?: string;
}

interface LookupResult {
    ok?: boolean;
    found?: boolean;
    phone?: string;
    state?: ConsentState | null;
    events?: ConsentEvent[];
    error?: string;
}

export default function SmsConsentView() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<LookupResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function lookup(e: React.FormEvent) {
        e.preventDefault();
        const term = query.trim();
        if (!term) return;

        setLoading(true);
        setError(null);
        try {
            // An @ is the only thing separating the two lookup modes, and it is a reliable
            // one: no phone number contains it and no email omits it.
            const param = term.includes('@') ? 'email' : 'phone';
            const res = await fetch(`/api/sms-consent?${param}=${encodeURIComponent(term)}`, {
                cache: 'no-store',
            });
            const body = (await res.json()) as LookupResult;
            if (!res.ok) throw new Error(body.error ?? `Lookup failed (${res.status})`);
            setResult(body);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lookup failed');
            // Deliberately keeps the previous result on screen: a failed lookup should not
            // wipe the record you were reading.
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="relative z-10 flex h-full flex-col">
            <NavSlot>
                <Link href="/" className="btn btn-xs">
                    <ArrowLeft size={12} weight="bold" /> Clients
                </Link>
            </NavSlot>

            <PageHeader
                title="SMS consent"
                lede="Proof of opt-in for the call alerts program. Search by mobile number or account email."
            />

            <form onSubmit={lookup} className="mb-6 flex flex-wrap gap-2">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="+19305551234 or owner@example.com"
                    className="min-w-0 flex-1 rounded border border-rule bg-surface px-3 py-2 text-sm text-fg outline-none"
                />
                <button type="submit" disabled={loading || !query.trim()} className="btn btn-sm">
                    {loading ? (
                        <CircleNotch size={13} weight="bold" className="animate-spin" />
                    ) : (
                        <MagnifyingGlass size={13} weight="bold" />
                    )}
                    Look up
                </button>
            </form>

            {error && (
                <p className="mb-4 rounded border border-rule bg-surface px-3 py-2 text-xs text-fg2">
                    {error}
                </p>
            )}

            {result && !result.found && (
                <p className="text-sm text-fg3">
                    No consent record for that {query.includes('@') ? 'account' : 'number'}. Nothing
                    was ever recorded, which means no alerts were ever enabled.
                </p>
            )}

            {result?.found && (
                <>
                    <div className="mb-5 rounded border border-rule bg-surface p-4">
                        <div className="mb-1 text-xs uppercase tracking-wide text-fg3">
                            Current state
                        </div>
                        <div className="text-sm text-fg">
                            {result.phone}
                            {' · '}
                            <span
                                className={
                                    result.state?.status === 'granted' ? 'text-fg' : 'text-fg3'
                                }
                            >
                                {result.state?.status ?? 'unknown'}
                            </span>
                            {result.state?.accountEmail ? ` · ${result.state.accountEmail}` : ''}
                        </div>
                        <div className="mt-1 text-xs text-fg3">
                            Last change {result.state?.updatedAt ?? 'unknown'}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-rule text-left text-fg3">
                                    <th className="py-2 pr-3 font-normal">When (UTC)</th>
                                    <th className="py-2 pr-3 font-normal">Action</th>
                                    <th className="py-2 pr-3 font-normal">Source</th>
                                    <th className="py-2 pr-3 font-normal">IP</th>
                                    <th className="py-2 pr-3 font-normal">Wording</th>
                                    <th className="py-2 font-normal">User agent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.events?.map((ev) => (
                                    <tr key={ev.id} className="border-b border-rule/50 align-top">
                                        <td className="py-2 pr-3 font-mono text-fg2">
                                            {ev.occurredAt}
                                        </td>
                                        <td className="py-2 pr-3 text-fg">{ev.action}</td>
                                        <td className="py-2 pr-3 text-fg2">{ev.source}</td>
                                        <td className="py-2 pr-3 font-mono text-fg2">{ev.ip}</td>
                                        <td className="py-2 pr-3 font-mono text-fg3">
                                            {/* Truncated for width; the version is what
                                                identifies the wording, the hash proves it. */}
                                            <span title={ev.consentTextHash}>
                                                {ev.consentTextVersion} · {ev.consentTextHash.slice(0, 12)}…
                                            </span>
                                        </td>
                                        <td className="py-2 text-fg3">{ev.userAgent}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
