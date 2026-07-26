'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CloudArrowDown, Folder, Plus, CircleNotch, Warning, PencilSimple, Check, X,
} from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import PlanChip from '@/components/PlanChip';

type IntakeSummary = {
  id: string;
  brandName: string;
  plan: string;
  slugGuess: string;
  receivedAt: number;
  missingFieldsCount: number;
};
// name/plan are null when clients/<slug>/site.ts is missing or unparseable.
type ClientInfo = { slug: string; hasRepo: boolean; name: string | null; plan: string | null };

/**
 * Stamp the loaded client's plan onto the seed content's `_meta.selectedPlan`, so the
 * studio's buildCategories() can auto-detect starter vs growth/enterprise and show the
 * right lead-capture components. The load routes return `plan` separately from `site`.
 */
function withPlan(seed: SiteContent | null, plan: unknown): SiteContent | null {
  if (!seed) return seed;
  if (plan !== 'starter' && plan !== 'growth' && plan !== 'enterprise') return seed;
  return { ...seed, _meta: { ...seed._meta, selectedPlan: plan } };
}

/**
 * One existing-client card. It is a div rather than a button because it contains its own
 * interactive controls (the rename pencil, and the input it swaps in) — nesting those in a
 * <button> is invalid HTML and behaves erratically. Keyboard parity is restored with
 * role/tabIndex/onKeyDown, and every edit control stops propagation so editing the name
 * never doubles as selecting the client.
 */
function ExistingClientCard({
  client, selected, busy, onChoose, onRename,
}: {
  client: ClientInfo;
  selected: boolean;
  busy: boolean;
  onChoose: () => void;
  onRename: (name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const display = client.name ?? client.slug;

  function begin(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(client.name ?? '');
    setEditing(true);
    // Focus after the input mounts.
    requestAnimationFrame(() => inputRef.current?.select());
  }

  async function commit() {
    const next = draft.trim();
    if (!next || next === client.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onRename(next);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div
      role="button"
      tabIndex={editing ? -1 : 0}
      aria-disabled={busy}
      onClick={() => !busy && !editing && onChoose()}
      onKeyDown={(e) => {
        if (editing || busy) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChoose();
        }
      }}
      className={[
        'flex cursor-pointer items-start justify-between gap-2 rounded-lg border bg-white p-4 text-left transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-uiAccent',
        busy ? 'opacity-60' : 'hover:border-uiInk',
        selected ? 'border-uiInk' : 'border-uiRule',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
              }}
              onBlur={commit}
              disabled={saving}
              placeholder="Display name"
              className="min-w-0 flex-1 rounded border border-uiInk px-1.5 py-0.5 font-display text-sm text-uiInk outline-none disabled:opacity-50"
            />
            {saving ? (
              <CircleNotch size={14} className="shrink-0 animate-spin text-uiInkSoft" />
            ) : (
              <>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // keep blur from firing first
                  onClick={commit}
                  aria-label="Save name"
                  className="shrink-0 text-uiInkSoft hover:text-uiInk"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setEditing(false)}
                  aria-label="Cancel rename"
                  className="shrink-0 text-uiInkSoft hover:text-uiInk"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 truncate font-display text-sm font-medium text-uiInk">{display}</p>
            <button
              type="button"
              onClick={begin}
              aria-label={`Rename ${display}`}
              className="shrink-0 rounded p-0.5 text-uiInkSoft/60 transition-colors hover:bg-uiSurface hover:text-uiInk focus-visible:ring-2 focus-visible:ring-uiAccent"
            >
              <PencilSimple size={13} />
            </button>
          </div>
        )}
        {client.name && <p className="truncate font-chromeMono text-kicker text-uiInkSoft">{client.slug}</p>}
        <p className="mt-1 font-chromeMono text-kicker uppercase tracking-wide text-uiInkSoft">
          {client.hasRepo ? 'has repo' : 'no repo yet'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {client.plan && <PlanChip plan={client.plan} />}
        {busy && <CircleNotch size={15} className="animate-spin text-uiInkSoft" />}
      </div>
    </div>
  );
}

function ago(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Step 1: choose the client to build for. Three sources —
 *  • incoming signups pulled from the KV intake queue ("New — from signup"),
 *  • existing client folders, and
 *  • create a blank client.
 * onChoose seeds the studio content (from the intake / existing site) and hands the
 * slug to the wizard.
 */
export default function ClientSelectStep({
  selectedSlug,
  onChoose,
}: {
  selectedSlug: string;
  onChoose: (slug: string, seed: SiteContent | null) => void;
}) {
  const [intakes, setIntakes] = useState<IntakeSummary[]>([]);
  const [configured, setConfigured] = useState(true);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // id/slug currently importing
  const [error, setError] = useState<string | null>(null);

  // Pending signup import: pick/confirm a slug before writing site.ts.
  const [pending, setPending] = useState<IntakeSummary | null>(null);
  const [pendingSlug, setPendingSlug] = useState('');
  const [overwrite, setOverwrite] = useState(false);

  const [blankSlug, setBlankSlug] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const [inboxRes, clientsRes] = await Promise.all([
        fetch('/api/intake/inbox', { cache: 'no-store' }),
        fetch('/api/build/clients', { cache: 'no-store' }),
      ]);
      const inbox = await inboxRes.json().catch(() => ({}));
      const cl = await clientsRes.json().catch(() => ({}));
      setIntakes(inbox.intakes ?? []);
      setConfigured(inbox.configured !== false);
      setClients(cl.clients ?? []);
    } catch {
      setError('Could not load clients.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  function beginImport(it: IntakeSummary) {
    setPending(it);
    setPendingSlug(it.slugGuess || '');
    setOverwrite(false);
    setError(null);
  }

  async function confirmImport() {
    if (!pending) return;
    const slug = pendingSlug.trim();
    if (!slug) return;
    setBusy(pending.id);
    setError(null);
    try {
      // Fetch full payload first so we can seed the studio even after the item is claimed.
      const fullRes = await fetch(`/api/intake/${pending.id}`, { cache: 'no-store' });
      const full = await fullRes.json();
      if (!fullRes.ok) throw new Error(full.error ?? 'Could not read intake.');

      const importRes = await fetch('/api/intake/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: pending.id, slug, overwrite }),
      });
      const imp = await importRes.json();
      if (!importRes.ok) {
        if (imp.needsOverwrite) {
          setError(`clients/${slug}/site.ts already exists — check overwrite or pick another slug.`);
          setBusy(null);
          return;
        }
        throw new Error(imp.error ?? 'Import failed.');
      }
      const seed = withPlan((full.intake?.intake?.sites?.[0] ?? null) as SiteContent | null, full.intake?.intake?.plan);
      setPending(null);
      onChoose(slug, seed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(null);
    }
  }

  async function chooseExisting(slug: string) {
    setBusy(slug);
    setError(null);
    try {
      const res = await fetch(`/api/build/load-client?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
      const data = await res.json();
      // Missing/empty site.ts is fine — proceed with whatever's in the studio.
      const seed = res.ok ? withPlan((data.site ?? null) as SiteContent | null, data.plan) : null;
      onChoose(slug, seed);
    } catch {
      onChoose(slug, null);
    } finally {
      setBusy(null);
    }
  }

  /** Commit an edited display name to clients/<slug>/site.ts, then refresh the list. */
  async function renameClient(slug: string, name: string) {
    setError(null);
    try {
      const res = await fetch('/api/build/rename-client', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Rename failed.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rename failed.');
    }
  }

  return (
    <div className="step-body max-w-5xl">
      <header className="mb-8">
        <p className="font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">Step 1</p>
        <h1 className="mt-2 font-display text-3xl font-medium text-uiInk">Choose a client</h1>
      </header>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <Warning size={16} /> {error}
        </div>
      )}

      {/* ── Incoming signups ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">
            <CloudArrowDown size={14} /> New — from signup
          </h2>
          <button
            type="button"
            onClick={refresh}
            className="font-chromeMono text-xs text-uiInkSoft hover:text-uiInk"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-uiInkSoft">
            <CircleNotch size={15} className="animate-spin" /> Loading…
          </p>
        ) : !configured ? (
          <p className="rounded-md border border-dashed border-uiRule px-4 py-6 text-center text-sm text-uiInkSoft">
            Intake queue not configured (no KV creds in <code>console/.env.local</code>). Existing
            &amp; blank clients still work.
          </p>
        ) : intakes.length === 0 ? (
          <p className="rounded-md border border-dashed border-uiRule px-4 py-6 text-center text-sm text-uiInkSoft">
            No pending signups. New ones from your agency site appear here.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {intakes.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => beginImport(it)}
                className="group flex flex-col rounded-lg border border-uiRule bg-white p-4 text-left transition-colors hover:border-uiInk"
              >
                <div className="flex items-center justify-between">
                  <PlanChip plan={it.plan} />
                  <span className="font-chromeMono text-kicker text-uiInkSoft">{ago(it.receivedAt)}</span>
                </div>
                <p className="mt-2 font-display text-lg font-medium text-uiInk">{it.brandName}</p>
                <p className="font-chromeMono text-xs text-uiInkSoft">{it.slugGuess}</p>
                {it.missingFieldsCount > 0 && (
                  <p className="mt-2 text-xs text-amber-700">{it.missingFieldsCount} field(s) need review</p>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Existing clients ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">
          <Folder size={14} /> Existing clients
        </h2>
        {clients.length === 0 ? (
          <p className="rounded-md border border-dashed border-uiRule px-4 py-6 text-center text-sm text-uiInkSoft">
            No client folders yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <ExistingClientCard
                key={c.slug}
                client={c}
                selected={selectedSlug === c.slug}
                busy={busy === c.slug}
                onChoose={() => chooseExisting(c.slug)}
                onRename={(name) => renameClient(c.slug, name)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Create blank ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">
          <Plus size={14} /> Create blank
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={blankSlug}
            onChange={(e) => setBlankSlug(e.target.value)}
            placeholder="new-client-slug"
            className="w-full max-w-xs rounded-md border border-uiRule px-3 py-2 font-chromeMono text-sm"
          />
          <button
            type="button"
            onClick={() => blankSlug.trim() && onChoose(blankSlug.trim(), null)}
            disabled={!/^[A-Za-z0-9_-]+$/.test(blankSlug.trim())}
            className="rounded-md bg-uiInk px-4 py-2 text-sm font-medium text-white hover:bg-uiInk/90 disabled:opacity-40"
          >
            Start blank
          </button>
        </div>
      </section>

      {/* ── Import-slug confirm sheet ────────────────────────────────────── */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-uiRule bg-white p-6 shadow-xl">
            <h3 className="font-display text-lg font-medium text-uiInk">Import “{pending.brandName}”</h3>
            <p className="mt-1 text-sm text-uiInkSoft">
              Confirm the client slug — this creates <code>clients/&lt;slug&gt;/site.ts</code>.
            </p>
            <input
              type="text"
              value={pendingSlug}
              onChange={(e) => setPendingSlug(e.target.value)}
              className="mt-4 w-full rounded-md border border-uiRule px-3 py-2 font-chromeMono text-sm"
            />
            <label className="mt-3 flex items-center gap-2 text-sm text-uiInkSoft">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              Overwrite if it already exists
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-md border border-uiRule px-3 py-1.5 text-sm text-uiInk hover:border-uiInk"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmImport}
                disabled={!/^[A-Za-z0-9_-]+$/.test(pendingSlug.trim()) || busy === pending.id}
                className="flex items-center gap-1.5 rounded-md bg-uiInk px-4 py-1.5 text-sm font-medium text-white hover:bg-uiInk/90 disabled:opacity-40"
              >
                {busy === pending.id && <CircleNotch size={14} className="animate-spin" />}
                Import &amp; continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
