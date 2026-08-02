'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowsClockwise, ArrowRight } from '@phosphor-icons/react';
import { STATUS_ORDER, type ClientContext, type OpsConfig, type Plan, type RunbookState } from '@/lib/types';
import type { ClientHealth } from '@/lib/health';
import { collectAttention, type AttentionItem } from '@/lib/attention';
import { effectiveStatus } from '@/lib/kanban';
import { useRunbookState } from '@/lib/useRunbookState';
import { useIntakeQueue, type IntakeSummary } from '@/lib/useIntakeQueue';
import NavSlot from '@/components/NavSlot';
import PageHeader from '@/components/shell/PageHeader';
import RefreshButton from '@/components/shell/RefreshButton';
import WarnBanner from '@/components/shell/WarnBanner';
import AttentionStrip from './AttentionStrip';
import ClientCard from './ClientCard';
import IndexControls, { type SortKey } from './IndexControls';
import IntakeCard from './IntakeCard';
import IntakeImportDialog from './IntakeImportDialog';
import NewClientCard from './NewClientCard';
import NewClientDialog from './NewClientDialog';

/**
 * The console's front door: every client, searchable, worst-first.
 *
 * This replaced a Kanban board, which is a genuinely good view that was answering the wrong
 * question here. The board showed "where is everyone in onboarding" — a weekly-review
 * question, organised around a phase each client passes through exactly once and then never
 * leaves. As a front door that means the last column becomes a growing pile of the clients
 * you visit most, there is no way to search, and nothing tells you a live site is down.
 *
 * That board is now gone entirely: it survived at /pipeline for a while and turned out to be
 * a second, worse copy of this screen. /leads took the route and the Kanban shape, and points
 * them at the one thing this index structurally cannot show — the people who aren't clients
 * yet.
 *
 * So: attention first (only when something is wrong), then search, then one flat list sorted
 * by what you'd most likely want — problems, then whatever you last touched.
 */

/**
 * Ordering.
 *
 * Whatever you sort by, clients with something WRONG float to the top first. A sort is a
 * preference about the healthy majority; a down site outranks it. Past that the chosen key
 * decides, and brand name is always the final tiebreak so the grid never shuffles between
 * renders on equal keys.
 */
function compareCards(
  a: ClientContext,
  b: ClientContext,
  sort: SortKey,
  attention: Map<string, AttentionItem>,
  lastTouched: Record<string, string>,
  health: Record<string, ClientHealth>,
  state: RunbookState,
): number {
  const ra = attention.get(a.slug)?.rank ?? Number.MAX_SAFE_INTEGER;
  const rb = attention.get(b.slug)?.rank ?? Number.MAX_SAFE_INTEGER;
  if (ra !== rb) return ra - rb;

  if (sort === 'touched') {
    const ta = lastTouched[a.slug] ?? '';
    const tb = lastTouched[b.slug] ?? '';
    if (ta !== tb) return tb.localeCompare(ta); // ISO strings, newest first
  } else if (sort === 'status') {
    // Earliest pipeline stage first — the ones still needing work lead.
    const d = STATUS_ORDER.indexOf(effectiveStatus(a, state)) - STATUS_ORDER.indexOf(effectiveStatus(b, state));
    if (d !== 0) return d;
  } else if (sort === 'health') {
    // Down, then unknown, then up: worst-first is the only useful direction here.
    const rank = (s: string) => {
      const ok = health[s]?.http?.ok;
      return ok === false ? 0 : ok === undefined ? 1 : 2;
    };
    const d = rank(a.slug) - rank(b.slug);
    if (d !== 0) return d;
  }

  return a.brandName.localeCompare(b.brandName);
}

export default function ClientIndex() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientContext[]>([]);
  const [config, setConfig] = useState<OpsConfig>({});
  const [activity, setActivity] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<Record<string, ClientHealth>>({});
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('touched');
  /** Empty = no plan filter. A filter nobody set shouldn't hide anything. */
  const [plans, setPlans] = useState<Set<Plan>>(new Set());
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  /**
   * `_`-prefixed fixtures are hidden by default — clients/ holds a handful of `_e2e*` folders
   * the provisioning tests run against, and a front door that is half test data is not a front
   * door. The toggle lives with the other filters in <IndexControls>, not in the console bar:
   * it changes what THIS grid shows, and the bar is shared with every other route.
   */
  const [showFixtures, setShowFixtures] = useState(false);
  /** Whether we've ever successfully loaded — decides fatal error vs. soft warning. */
  const hasData = useRef(false);

  const { state } = useRunbookState();
  const { intakes, error: intakeError, importIntake } = useIntakeQueue();
  /** The signup whose slug is being confirmed, and the one currently being written. */
  const [pendingIntake, setPendingIntake] = useState<IntakeSummary | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  // Read the fixture preference BEFORE the first fetch, so we don't load the list twice on
  // mount. It can't go in a useState initializer: this component server-renders, and
  // localStorage doesn't exist there.
  const [prefsRead, setPrefsRead] = useState(false);
  useEffect(() => {
    try {
      setShowFixtures(localStorage.getItem('console:fixtures') === '1');
    } catch {
      /* ignore */
    }
    setPrefsRead(true);
  }, []);

  const qs = showFixtures ? '?fixtures=1' : '';

  // A refresh failure must NOT destroy the view — keep the last-known clients and surface a
  // dismissible banner. Hard error only when there is nothing to show.
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/runbook/clients${qs}`, { cache: 'no-store' });
      const data = (await res.json()) as {
        clients?: ClientContext[];
        config?: OpsConfig;
        activity?: Record<string, string>;
        error?: string;
      };
      const list = data.clients ?? [];
      setClients(list);
      hasData.current = list.length > 0;
      setConfig(data.config ?? {});
      setActivity(data.activity ?? {});
      if (data.error) {
        if (list.length === 0) setError(data.error);
        else setWarning(data.error);
      } else {
        setError(null);
        setWarning(null);
      }
    } catch {
      const msg = 'Couldn’t reach the console dev server (is it still running?).';
      if (hasData.current) setWarning(msg);
      else setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [qs]);

  /**
   * Live health, fetched SEPARATELY from the client list and never awaited alongside it. The
   * probe inside /api/manage/roster can hang for seconds on an unreachable domain, and the
   * list has to paint immediately — the whole point of this screen is picking someone.
   */
  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch(`/api/manage/roster${qs}`, { cache: 'no-store' });
      const data = await res.json();
      setHealth(data.health ?? {});
    } catch {
      /* health is supplementary here — a failure just leaves the cells empty */
    }
  }, [qs]);

  useEffect(() => {
    if (!prefsRead) return;
    load();
    loadHealth();
  }, [prefsRead, load, loadHealth]);

  const toggleFixtures = useCallback(() => {
    setShowFixtures((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('console:fixtures', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // A client just created has no work in it yet, so it goes straight to Build rather than
  // through the status routing at /c/{slug}.
  const openBuild = useCallback((slug: string) => router.push(`/c/${slug}/build`), [router]);

  /**
   * Claim a signup and reload the roster so its card converts in place.
   *
   * Deliberately does NOT jump to Build. The import is the moment a signup becomes a client,
   * and the card turning from a teal "New signup" tile into a real ClientCard — in the same
   * grid cell — is what shows that. Navigating away means you never see the transition and
   * land in a builder you may not have wanted yet; the new card's own Build link is one
   * click, and now it's a decision rather than a redirect.
   */
  const confirmImport = useCallback(
    async (slug: string, overwrite: boolean): Promise<string | null> => {
      if (!pendingIntake) return 'No signup selected.';
      setImporting(pendingIntake.id);
      const message = await importIntake(pendingIntake.id, slug, overwrite);
      setImporting(null);
      if (message) return message;
      // The folder now exists, so the roster fetch will return it as a real client.
      await Promise.all([load(), loadHealth()]);
      return null;
    },
    [pendingIntake, importIntake, load, loadHealth],
  );

  const attentionItems = useMemo(
    () => collectAttention(clients, state, health, activity),
    [clients, state, health, activity],
  );
  const attentionBySlug = useMemo(
    () => new Map(attentionItems.map((a) => [a.slug, a])),
    [attentionItems],
  );

  const togglePlan = useCallback((p: Plan) => {
    setPlans((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = clients.filter((c) => {
      if (q && !c.brandName.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q)) {
        return false;
      }
      if (plans.size > 0 && !plans.has(c.plan)) return false;
      if (attentionOnly && !attentionBySlug.has(c.slug)) return false;
      return true;
    });
    return filtered.sort((a, b) =>
      compareCards(a, b, sort, attentionBySlug, activity, health, state),
    );
  }, [clients, query, plans, attentionOnly, sort, attentionBySlug, activity, health, state]);

  /** Any filter narrowing the grid. Decides whether the add-card and "No matches" show. */
  const filtering = query.trim() !== '' || plans.size > 0 || attentionOnly;

  /**
   * Pending signups, filtered by the two controls that actually apply to them.
   *
   * Query and plan match on real properties an intake has. `attentionOnly` hides them all:
   * attention is computed from disk state, and an unclaimed signup has none — showing it
   * under a filter that means "things that are wrong" would misreport it as a problem.
   */
  const visibleIntakes = useMemo(() => {
    if (attentionOnly) return [];
    const q = query.trim().toLowerCase();
    return intakes.filter((it) => {
      if (q && !it.brandName.toLowerCase().includes(q) && !it.slugGuess.toLowerCase().includes(q)) {
        return false;
      }
      if (plans.size > 0 && !plans.has(it.plan)) return false;
      return true;
    });
  }, [intakes, query, plans, attentionOnly]);

  return (
    <div className="relative z-10 flex h-full flex-col">
      {/* The bar used to carry all four of these plus a "Clients" title. Now: the title is a
          real h1 in the page below, Refresh is an icon in the navbar's utility cluster
          (where every route's refresh lives), "New client" is the first card in the grid,
          and only the cross-route link is left as an action. */}
      <NavSlot>
        <Link href="/leads" className="btn btn-xs">
          Leads <ArrowRight size={12} weight="bold" />
        </Link>
      </NavSlot>

      <RefreshButton onClick={load} busy={refreshing} />

      {warning && !error && (
        <WarnBanner
          message={warning}
          onRetry={load}
          onDismiss={() => setWarning(null)}
          busy={refreshing}
        />
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="meta text-fg3">Reading clients/ …</p>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-start justify-start px-6 py-10 md:px-10">
          <div className="panel max-w-md p-6">
            <h3 className="mb-1 font-display text-base font-medium" style={{ color: 'var(--danger)' }}>
              Couldn&apos;t load clients
            </h3>
            <p className="text-xs text-fg2">{error}</p>
            <p className="mt-2 text-2xs text-fg3">
              The console runs from <code className="codechip">jdd-ops/console</code> and reads{' '}
              <code className="codechip">../clients</code>. Start it with{' '}
              <code className="codechip">npm run console</code> from the jdd-ops root.
            </p>
            <button type="button" onClick={load} className="btn btn-sm mt-3" disabled={refreshing}>
              <ArrowsClockwise size={13} className={refreshing ? 'animate-spin' : undefined} /> Try
              again
            </button>
          </div>
        </div>
      ) : (
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <AttentionStrip items={attentionItems} />

          <div className="mx-auto w-full max-w-[1180px] px-6 py-8 md:px-8">
            <PageHeader title="Clients" lede="Everything under clients/, worst first." />

            <IndexControls
              query={query}
              onQuery={setQuery}
              sort={sort}
              onSort={setSort}
              plans={plans}
              onTogglePlan={togglePlan}
              attentionOnly={attentionOnly}
              onToggleAttentionOnly={() => setAttentionOnly((v) => !v)}
              attentionCount={attentionItems.length}
              showFixtures={showFixtures}
              onToggleFixtures={toggleFixtures}
              shown={cards.length}
              total={clients.length}
            />

            {intakeError && (
              <p className="meta mb-3" style={{ color: 'var(--warn)' }}>
                {intakeError}
              </p>
            )}

            {/* Front of the grid, in order: add-card, then unclaimed signups, then clients.
                New work first, in the one place your eye already goes.

                The add-card is suppressed only while a filter is narrowing the list, where
                "add" would be answering a question nobody asked. With no clients and no
                signups the grid still renders exactly one card, and it's the right one — so
                the empty state needs no special copy. */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {!filtering && <NewClientCard onClick={() => setCreating(true)} />}

              {visibleIntakes.map((it) => (
                <IntakeCard
                  key={it.id}
                  intake={it}
                  busy={importing === it.id}
                  onImport={() => setPendingIntake(it)}
                />
              ))}

              {cards.map((c) => (
                <ClientCard
                  key={c.slug}
                  ctx={c}
                  clientState={state[c.slug]}
                  config={config}
                  health={health[c.slug]}
                  lastTouched={activity[c.slug]}
                  attention={attentionBySlug.get(c.slug)}
                  onSelect={() => router.push(`/c/${c.slug}`)}
                />
              ))}
            </div>

            {filtering && cards.length === 0 && (
              <p className="py-16 text-center text-xs text-fg3">No matches.</p>
            )}
          </div>
        </div>
      )}

      {creating && <NewClientDialog onCreated={openBuild} onClose={() => setCreating(false)} />}

      {pendingIntake && (
        <IntakeImportDialog
          intake={pendingIntake}
          onConfirm={confirmImport}
          onClose={() => setPendingIntake(null)}
        />
      )}
    </div>
  );
}
