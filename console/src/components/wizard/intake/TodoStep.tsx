'use client';

/**
 * Step 11, Still to do: everything not supplied by the onboarding form, the close or the
 * console, grouped by the step that fixes it, each with a jump. Once the intake has run,
 * reopening it lands here (lib/intake-steps.ts landingStepId).
 *
 * Approve lives here (it was on the Review step): this is the one screen that names everything
 * outstanding, so the gate's reason is visible beside the button. The gate is unchanged: a
 * generated section still ticked for regeneration hasn't been read, and blocks it.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import type { CopyRisks } from '@/lib/copyRisks';
import { claimGroups, presetGroups, pathLabel, type RiskGroup, type RiskTarget } from '@/lib/intake-risks';
import type { TodoItem, TodoStep as TodoGroup } from '@/lib/intake-todo';
import { SOURCE_LABEL, type FactSource } from '@/lib/intake-sources';
import { Card, StatusMark, Tag } from './ui';

const GROUPS: Array<{ id: TodoGroup; title: string }> = [
  { id: 'business', title: 'Business' },
  { id: 'services', title: 'Services' },
  { id: 'area', title: 'Area & profiles' },
  { id: 'reviews', title: 'Reviews' },
  { id: 'words', title: 'Their words' },
  { id: 'review', title: 'Copy review' },
];

/** 2 columns below 1280px, 3 on a laptop, 4 from 1720px: the width a group needs to stay legible. */
function useColumnCount(): number {
  const [n, setN] = useState(3);
  useEffect(() => {
    const pick = () => setN(window.innerWidth >= 1720 ? 4 : window.innerWidth >= 1280 ? 3 : 2);
    pick();
    window.addEventListener('resize', pick);
    return () => window.removeEventListener('resize', pick);
  }, []);
  return n;
}

/** Greedy: biggest group first, into the column with the fewest rows; order kept within a column. */
function packColumns<T extends { id: string; items: unknown[] }>(groups: T[], n: number): T[][] {
  const cols: T[][] = Array.from({ length: n }, () => []);
  const load = Array(n).fill(0);
  const order = new Map(groups.map((g, i) => [g.id, i]));
  for (const g of [...groups].sort((a, b) => b.items.length - a.items.length)) {
    const k = load.indexOf(Math.min(...load));
    cols[k].push(g);
    load[k] += g.items.length + 1;
  }
  return cols.map((c) => c.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))).filter((c) => c.length);
}

function statusChip(it: TodoItem) {
  if (it.optional) return <Tag>Optional</Tag>;
  switch (it.status) {
    case 'short': return <Tag tone="warn">Section only</Tag>;
    case 'none': return <Tag tone="warn">None yet</Tag>;
    case 'unsourced': return <Tag tone="warn">Source</Tag>;
    case 'unreviewed': return <Tag tone="warn">To review</Tag>;
    case 'page': return <Tag tone="teal">Own page</Tag>;
    default: return <Tag tone="warn">{SOURCE_LABEL[it.status as FactSource]}</Tag>;
  }
}

export default function TodoStep({
  items, lastRunAt, stats, onJump, blocked, gateReason, onApprove, onRerun, risks, onRiskJump,
}: {
  items: TodoItem[];
  lastRunAt?: string;
  stats: Array<{ value: string; label: string; ok?: boolean }>;
  onJump: (item: TodoItem) => void;
  blocked: boolean;
  gateReason?: string;
  onApprove: () => void;
  onRerun: () => void;
  /** client-seo's copyRisks over the intake's effective content (SEO plan D2). */
  risks: CopyRisks;
  onRiskJump: (target: RiskTarget) => void;
}) {
  const claims = useMemo(() => claimGroups(risks), [risks]);
  const presets = useMemo(() => presetGroups(risks), [risks]);
  const riskCount = risks.unsupportedClaims.length + risks.presetCopy.length;
  const [view, setView] = useState<'todo' | 'risks'>('todo');
  const required = items.filter((i) => !i.optional).length;
  const groups = GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.step === g.id) })).filter((g) => g.items.length > 0);
  const cols = Math.max(1, Math.min(useColumnCount(), groups.length));
  const columns = packColumns(groups, cols);
  const ran = lastRunAt ? new Date(lastRunAt) : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 px-6 py-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
        <h2 className="font-display text-[28px] font-bold leading-none text-uiInk">Still to do</h2>
        <span className="font-chromeMono text-2xs text-uiFg3">
          {ran
            ? `Intake run ${ran.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${ran.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
            : 'Intake not run yet'}
        </span>
        <span className="ml-auto text-xs text-uiFg3">Anything not supplied by the onboarding form, the close or the console.</span>
      </div>

      <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col gap-3.5">
        {riskCount > 0 && (
          <RiskBand
            claims={claims.reduce((n, g) => n + g.rows.length, 0)}
            claimKinds={claims.length}
            preset={presets.reduce((n, g) => n + g.rows.length, 0)}
            open={view === 'risks'}
            onToggle={() => setView(view === 'risks' ? 'todo' : 'risks')}
          />
        )}
        {view === 'risks' && riskCount > 0 ? (
          <RisksView claims={claims} presets={presets} onJump={onRiskJump} />
        ) : groups.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-uiCardRule text-sm text-uiFg2">
            <CheckCircle size={18} weight="fill" style={{ color: 'var(--ok)' }} /> Nothing outstanding.
          </div>
        ) : (
          // Columns, not rows: each group goes to the shortest column and takes height in
          // proportion to its items, so a long group never overflows while a short one sits
          // in a half-empty row.
          <div className="grid min-h-0 gap-3.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {columns.map((col, ci) => (
              <div key={ci} className="flex min-h-0 flex-col gap-3.5">
                {col.map((g) => {
                  const n = g.items.filter((i) => !i.optional).length;
                  return (
                    <Card
                      key={g.id}
                      title={g.title}
                      className="min-h-[96px]"
                      right={n > 0 && <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 font-chromeMono text-[10.5px] text-white" style={{ background: 'var(--warn)' }}>{n}</span>}
                    >
                      <ul className="divide-y divide-uiCardRule/40">
                        {g.items.map((it) => (
                          <li key={it.key} className="grid grid-cols-[16px_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 px-3.5 py-2">
                            <StatusMark ok={false} optional={it.optional} />
                            <div className="min-w-0">
                              <p className="truncate text-[13.5px] font-semibold text-uiInk">{it.label}</p>
                              <p className="line-clamp-2 text-xs leading-snug text-uiFg3" title={it.detail}>{it.detail}</p>
                            </div>
                            {statusChip(it)}
                            <button
                              type="button"
                              onClick={() => onJump(it)}
                              aria-label={`${it.key === 'reviews.none' ? 'Add' : 'Go to'} ${it.label}`}
                              className="inline-flex h-6 items-center gap-1 rounded-md border border-uiCardRule bg-panel px-2 text-xs text-uiInk hover:border-uiAccent"
                            >
                              {it.key === 'reviews.none' ? 'Add' : 'Go'} <ArrowRight size={11} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        </div>

        <Card title="This client" bodyClassName="flex flex-col px-4 pb-4">
          {stats.map((s) => (
            <div key={s.label} className="border-b border-uiCardRule/40 py-2.5 last:border-b-0">
              <p className="font-display text-[26px] font-bold leading-none" style={{ color: s.ok ? 'var(--ok)' : 'var(--ui-ink)' }}>{s.value}</p>
              <p className="mt-0.5 text-xs text-uiFg3">{s.label}</p>
            </div>
          ))}
          <div className="mt-auto flex flex-col gap-2 pt-3">
            {required > 0 && (
              <p className="text-2xs leading-relaxed text-uiFg3">{required} required item{required === 1 ? '' : 's'} open. Approve is still possible; the site builds from what is here.</p>
            )}
            {blocked && gateReason && (
              <p className="text-2xs leading-relaxed" style={{ color: 'var(--warn)' }}>{gateReason}</p>
            )}
            {riskCount > 0 && (
              <p className="flex items-start gap-1.5 rounded-md px-2 py-1.5 text-2xs font-semibold leading-relaxed" style={{ background: 'var(--warn-glow)', color: '#7d500f' }}>
                <WarningCircle size={13} weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
                Copy still carries {riskCount} unchecked item{riskCount === 1 ? '' : 's'}. Approve is not blocked.
              </p>
            )}
            <button type="button" onClick={onRerun} className="btn justify-center">Re-run copy</button>
            <button
              type="button"
              onClick={onApprove}
              disabled={blocked}
              title={gateReason}
              className="btn btn-primary h-10 justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve · open Studio <ArrowRight size={14} />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * The loud part (SEO plan D2: "Warn loudly at the end of the intake wizard before we move onto
 * the build wizard"). Always at the top of Still to do while anything is found; never a block.
 */
function RiskBand({
  claims, claimKinds, preset, open, onToggle,
}: {
  claims: number;
  claimKinds: number;
  preset: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border-2 px-4 py-3"
      style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)' }}
    >
      <WarningCircle size={26} weight="fill" style={{ color: 'var(--warn)', flexShrink: 0 }} />
      <div className="min-w-0">
        <p className="font-display text-xl font-bold leading-tight text-uiInk">Copy to check before the Studio</p>
        <p className="text-[13px] text-uiFg2">
          {claims > 0 && <><b>{claims}</b> claim{claims === 1 ? '' : 's'} not in the client&apos;s facts ({claimKinds} kind{claimKinds === 1 ? '' : 's'})</>}
          {claims > 0 && preset > 0 && ' · '}
          {preset > 0 && <><b>{preset}</b> field{preset === 1 ? '' : 's'} still the preset&apos;s sample copy</>}
          . Not a block.
        </p>
      </div>
      <button type="button" onClick={onToggle} className="btn btn-sm ml-auto" aria-expanded={open}>
        {open ? 'Still to do list' : 'Show copy to check'}
      </button>
    </div>
  );
}

function RisksView({
  claims, presets, onJump,
}: {
  claims: RiskGroup[];
  presets: RiskGroup[];
  onJump: (t: RiskTarget) => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-2">
      <Card title="Claims not in the client's facts" right={<span className="font-chromeMono text-2xs text-uiFg3">{claims.reduce((n, g) => n + g.rows.length, 0)}</span>}>
        {claims.length === 0 ? (
          <p className="p-3.5 text-xs italic text-uiFg3">None found.</p>
        ) : (
          <ul className="divide-y divide-uiCardRule/40">
            {claims.map((g) => (
              <li key={g.key} className="px-3.5 py-1.5">
                <p className="flex items-center gap-2">
                  <Tag tone="warn">{g.label}</Tag>
                  <span className="font-chromeMono text-2xs text-uiFg3">{g.rows.length}</span>
                </p>
                <ul className="mt-1">
                  {g.rows.map((r) => (
                    <li key={`${g.key}-${r.path}`} className="grid h-[22px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <p className="min-w-0 truncate text-xs text-uiFg2" title={r.text}>
                        <span className="font-chromeMono text-[10.5px] text-uiFg3">{pathLabel(r.path)}</span> {r.text}
                      </p>
                      <button type="button" onClick={() => onJump(r.target)} aria-label={`Go to ${pathLabel(r.path)}`} className="inline-flex h-5 items-center gap-1 rounded-md border border-uiCardRule bg-panel px-1.5 text-xs text-uiInk hover:border-uiAccent">
                        Go <ArrowRight size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Preset sample copy" right={<span className="font-chromeMono text-2xs text-uiFg3">{presets.reduce((n, g) => n + g.rows.length, 0)}</span>}>
        {presets.length === 0 ? (
          <p className="p-3.5 text-xs italic text-uiFg3">None found.</p>
        ) : (
          <ul className="divide-y divide-uiCardRule/40">
            {presets.map((g) => (
              <li key={g.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3.5 py-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-uiInk">{g.label} <span className="font-chromeMono text-2xs font-normal text-uiFg3">{g.rows.length} field{g.rows.length === 1 ? '' : 's'}</span></p>
                  <p className="truncate text-xs text-uiFg3" title={g.rows.map((r) => `${pathLabel(r.path)}: ${r.text}`).join('\n')}>
                    {g.rows.map((r) => pathLabel(r.path).split(' · ').slice(1).join(' ') || pathLabel(r.path)).join(', ')}
                  </p>
                </div>
                <button type="button" onClick={() => onJump(g.rows[0].target)} aria-label={`Go to ${g.label}`} className="inline-flex h-6 items-center gap-1 rounded-md border border-uiCardRule bg-panel px-2 text-xs text-uiInk hover:border-uiAccent">
                  Go <ArrowRight size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
