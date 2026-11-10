'use client';
// The sales tool: a reference panel that opens beside a lead while you're on the phone with them.
//
// It replaced the branching call-script wizard (2026-11-10). Nothing here moves you through a
// call. Three tabs hold what you might need to say: what the system does, what each plan
// includes, and the objections with the answer that meets each one. One search box looks across
// all three, because mid-call you know what they just said, not which tab it lives in.
//
// Keys, while the panel is open: / jumps to search, 1 2 3 switch tabs, Esc clears the search and
// then closes the panel. Esc is caught in the capture phase so the lead modal underneath doesn't
// close in the same keypress, except while a field in the lead card itself is being edited, where
// Esc belongs to that field.
//
// The words are in lib/sales-tool.ts, approved line by line. Don't put copy in this file.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Calculator,
  CalendarPlus,
  CaretRight,
  Check,
  MagnifyingGlass,
  Phone,
  Sparkle,
  Tray,
  User,
  X,
} from '@phosphor-icons/react';
import type { PlanInterest } from '@/lib/leadTypes';
import {
  CALC_UI,
  CATEGORIES,
  DEFAULT_OBJECTION,
  DEMO_LINE,
  FLOW,
  KEY_POINT_GROUPS,
  OBJECTIONS,
  PLAN_FOOTNOTES,
  PLAN_ROWS,
  PLAN_UI,
  TABS,
  TIERS,
  TOOL_NAME,
  UI,
  calcOutcome,
  fmtDollars,
  keyPoint,
  searchSalesTool,
  type FlowIcon,
  type KeyPoint,
  type KeyPointId,
  type Objection,
  type ObjectionCategory,
  type PlanCell,
  type PlanRow,
  type SalesTab,
} from '@/lib/sales-tool';

const TAB_KEY = 'jdd:sales-tool:tab';

function readTab(): SalesTab {
  try {
    const v = window.localStorage.getItem(TAB_KEY);
    if (v && TABS.some((t) => t.id === v)) return v as SalesTab;
  } catch {
    /* storage blocked */
  }
  return 'objections';
}

function writeTab(tab: SalesTab) {
  try {
    window.localStorage.setItem(TAB_KEY, tab);
  } catch {
    /* storage blocked */
  }
}

const FLOW_ICON: Record<FlowIcon, typeof User> = { caller: User, phone: Phone, ai: Sparkle, inbox: Tray };

/** Wraps each occurrence of the query in a <mark>. */
function Hi({ text, q }: { text: string; q: string }) {
  const needle = q.trim().toLowerCase();
  if (!needle) return <>{text}</>;
  const out: ReactNode[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const at = lower.indexOf(needle, i);
    if (at < 0) {
      out.push(text.slice(i));
      break;
    }
    if (at > i) out.push(text.slice(i, at));
    out.push(
      <mark key={at} className="rounded-[3px] px-px text-inherit" style={{ background: 'var(--warn-glow)' }}>
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    i = at + needle.length;
  }
  return <>{out}</>;
}

interface SalesToolProps {
  planInterest: PlanInterest | null;
  /** Set the lead's plan. Same toggle as the plan pills: picking the current plan clears it. */
  onSetPlan: (plan: PlanInterest | null) => void;
  onAddToCalendar: () => void;
  onClose: () => void;
  /** Too narrow to sit beside the lead: lay the panel over its right side instead. */
  overlay: boolean;
}

export default function SalesTool({ planInterest, onSetPlan, onAddToCalendar, onClose, overlay }: SalesToolProps) {
  const reduce = useReducedMotion();
  const [tab, setTabState] = useState<SalesTab>(readTab);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ObjectionCategory | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(DEFAULT_OBJECTION);
  const [annual, setAnnual] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calc, setCalc] = useState({ calls: '', job: '', rec: '' });
  const [copied, setCopied] = useState(false);
  const [flashId, setFlashId] = useState<KeyPointId | null>(null);

  const rootRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef(query);
  queryRef.current = query;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const setTab = (t: SalesTab) => {
    setTabState(t);
    writeTab(t);
  };

  const results = useMemo(() => searchSalesTool(query), [query]);
  const searching = query.trim().length > 0;

  // Search lands on the panel, so the operator can start typing the moment it opens.
  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const inTool = Boolean(el && rootRef.current?.contains(el));
      const typing = Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
      if (e.key === 'Escape') {
        if (typing && !inTool) return;
        e.preventDefault();
        e.stopPropagation();
        if (queryRef.current) {
          setQuery('');
          searchRef.current?.focus();
        } else {
          closeRef.current();
        }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      const n = ['1', '2', '3'].indexOf(e.key);
      if (n >= 0) {
        setQuery('');
        setTab(TABS[n].id);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // "Answered by" jumps to the key point and lights it up for a moment.
  useEffect(() => {
    if (!flashId) return;
    document.getElementById(`sales-kp-${flashId}`)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    const t = setTimeout(() => setFlashId(null), 1400);
    return () => clearTimeout(t);
  }, [flashId, reduce]);

  function onQuery(value: string) {
    setQuery(value);
    // Open the best match so the answer is already on screen.
    const first = searchSalesTool(value).objections[0];
    if (first) setOpenId(first.id);
  }

  function showKeyPoint(id: KeyPointId) {
    setQuery('');
    setTab('system');
    setFlashId(id);
  }

  async function copyDemo() {
    try {
      await navigator.clipboard.writeText(DEMO_LINE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  }

  const ctx: AnswerCtx = {
    q: query,
    openId,
    setOpenId,
    calcOpen,
    setCalcOpen,
    calc,
    setCalc,
    copied,
    copyDemo,
    showKeyPoint,
    onAddToCalendar,
  };

  return (
    <motion.aside
      ref={rootRef}
      aria-label={TOOL_NAME}
      initial={reduce ? false : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduce ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={`panel pointer-events-auto flex flex-col overflow-hidden ${
        overlay ? 'absolute bottom-0 right-0 top-0 z-[2] w-[min(480px,100%)]' : 'w-[480px] shrink-0'
      }`}
      style={overlay ? { boxShadow: '0 24px 60px -20px rgba(20,18,12,0.45)' } : undefined}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-3.5">
        <span className="flex items-center gap-2 whitespace-nowrap text-[15px] font-semibold">
          <BookOpen size={16} style={{ color: 'var(--accent)' }} />
          {TOOL_NAME}
        </span>
        <span
          className="ml-auto flex items-center gap-2 whitespace-nowrap rounded-full border border-rule py-1 pl-2.5 pr-1 text-xs"
          style={{ background: 'var(--surface)' }}
        >
          <span className="text-fg3">{UI.demo}</span>
          <span className="mono select-all text-[12.5px] text-fg">{DEMO_LINE}</span>
          <button
            type="button"
            onClick={copyDemo}
            className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
            style={{ background: copied ? 'var(--ok)' : 'var(--fg)', color: 'var(--bg)' }}
          >
            {copied ? UI.copied : UI.copy}
          </button>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close the ${TOOL_NAME.toLowerCase()}`}
          className="rounded p-1 text-fg3 hover:text-fg"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative mx-4">
        <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg3" />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={UI.search}
          aria-label={UI.search}
          autoComplete="off"
          className="h-10 w-full rounded-[10px] border pl-9 pr-12 text-sm outline-none transition-shadow focus:shadow-[0_0_0_3px_var(--accent-glow)]"
          style={{ borderColor: 'var(--rule-strong)', background: 'var(--panel)' }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              searchRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex -translate-y-1/2 rounded-[6px] p-1 text-fg2"
            style={{ background: 'var(--surface-2)' }}
          >
            <X size={12} />
          </button>
        ) : (
          <span
            className="mono pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[5px] border border-b-2 border-rule px-1.5 text-[11px] leading-[18px] text-fg3"
            aria-hidden="true"
          >
            /
          </span>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0.5 border-b border-rule px-4 pt-3" role="tablist" aria-label={TOOL_NAME}>
        {TABS.map((t, i) => {
          const active = !searching && tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setQuery('');
                setTab(t.id);
              }}
              className="relative flex items-center gap-1.5 px-3 pb-2.5 pt-2 text-[13.5px] font-medium transition-colors"
              style={{ color: active ? 'var(--fg)' : 'var(--fg-3)' }}
            >
              {t.label}
              <span className="mono text-[10px] opacity-70">{i + 1}</span>
              {active && (
                <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-sm" style={{ background: 'var(--accent-2)' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Body ── */}
      <div className="no-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {searching ? (
          <SearchResultsView
            results={results}
            ctx={ctx}
            annual={annual}
            planInterest={planInterest}
            onSetPlan={onSetPlan}
          />
        ) : tab === 'system' ? (
          <SystemView flashId={flashId} />
        ) : tab === 'plans' ? (
          <PlansView
            rows={PLAN_ROWS}
            annual={annual}
            setAnnual={setAnnual}
            planInterest={planInterest}
            onSetPlan={onSetPlan}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const on = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className="rounded-full border px-3 py-1 text-xs transition-colors"
                    style={{
                      borderColor: on ? 'var(--fg)' : 'var(--rule)',
                      background: on ? 'var(--fg)' : 'transparent',
                      color: on ? 'var(--bg)' : 'var(--fg-2)',
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <ObjectionList list={OBJECTIONS.filter((o) => category === 'all' || o.category === category)} ctx={ctx} />
          </>
        )}
      </div>

      <div className="border-t border-rule px-4 py-2 text-[11.5px] text-fg3">{UI.hint}</div>
    </motion.aside>
  );
}

/* ─────────────────────────────  System  ───────────────────────────── */

function KeyPointRow({ point, flash, q = '' }: { point: KeyPoint; flash?: boolean; q?: string }) {
  return (
    <div
      id={`sales-kp-${point.id}`}
      className="-mx-2.5 grid grid-cols-[18px_1fr] gap-x-2.5 gap-y-0.5 rounded-[9px] px-2.5 py-2 transition-colors duration-500"
      style={{ background: flash ? 'var(--warn-glow)' : 'transparent' }}
    >
      <Check size={14} weight="bold" className="mt-[3px]" style={{ color: 'var(--ok)' }} />
      <span className="text-[13.5px] font-semibold text-fg">
        <Hi text={point.title} q={q} />
      </span>
      <span className="col-start-2 text-[12.5px] leading-[1.45] text-fg2">
        <Hi text={point.line} q={q} />
      </span>
    </div>
  );
}

function SystemView({ flashId }: { flashId: KeyPointId | null }) {
  return (
    <>
      <ol className="grid grid-cols-4 overflow-hidden rounded-[12px] border border-rule" style={{ background: 'var(--surface)' }}>
        {FLOW.map((step, i) => {
          const Icon = FLOW_ICON[step.icon];
          const fill = step.icon === 'ai' ? 'var(--accent)' : step.icon === 'inbox' ? 'var(--accent-2)' : null;
          return (
            <li
              key={step.label}
              className={`flex flex-col gap-2 px-3 py-3 text-[12.5px] font-semibold leading-[1.3] text-fg ${i ? 'border-l border-rule' : ''}`}
            >
              <span
                className="grid h-[26px] w-[26px] place-items-center rounded-full border"
                style={
                  fill
                    ? { background: fill, borderColor: fill, color: 'var(--bg)' }
                    : { background: 'var(--panel)', borderColor: 'var(--rule-strong)', color: 'var(--fg-2)' }
                }
              >
                <Icon size={13} weight={fill ? 'fill' : 'regular'} />
              </span>
              {step.label}
            </li>
          );
        })}
      </ol>
      {KEY_POINT_GROUPS.map((g) => (
        <section key={g.label} className="flex flex-col gap-0.5">
          <h4 className="meta mb-1.5 text-[10.5px] uppercase tracking-[0.1em]">{g.label}</h4>
          {g.points.map((p) => (
            <KeyPointRow key={p.id} point={p} flash={flashId === p.id} />
          ))}
        </section>
      ))}
    </>
  );
}

/* ─────────────────────────────  Plans  ───────────────────────────── */

function Cell({ cell }: { cell: PlanCell }) {
  if (cell.kind === 'yes') return <Check size={15} weight="bold" className="inline" style={{ color: 'var(--ok)' }} aria-label="Included" />;
  if (cell.kind === 'no')
    return (
      <span
        className="inline-block h-1.5 w-1.5 rounded-full border-[1.5px]"
        style={{ borderColor: 'var(--rule-strong)' }}
        aria-label="Not included"
      />
    );
  if (cell.kind === 'gate')
    return (
      <span
        className="inline-block rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold leading-tight"
        style={{ color: 'var(--warn)', background: 'var(--warn-glow)' }}
      >
        {cell.text}
      </span>
    );
  return <span className="tabular-nums">{cell.text}</span>;
}

function PlansView({
  rows,
  annual,
  setAnnual,
  planInterest,
  onSetPlan,
  q = '',
}: {
  rows: PlanRow[];
  annual: boolean;
  setAnnual?: (v: boolean) => void;
  planInterest: PlanInterest | null;
  onSetPlan: (plan: PlanInterest | null) => void;
  q?: string;
}) {
  const hl = (id: PlanInterest) => (planInterest === id ? { background: 'rgba(31, 111, 120, 0.10)' } : undefined);
  return (
    <>
      {setAnnual && (
        <div className="flex items-center gap-2.5">
          <div className="inline-flex gap-[3px] rounded-[10px] border p-[3px]" style={{ borderColor: 'var(--rule-strong)' }} role="group" aria-label="Billing">
            {[
              { v: false, label: PLAN_UI.monthly },
              { v: true, label: PLAN_UI.annual },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={annual === o.v}
                onClick={() => setAnnual(o.v)}
                className="rounded-[7px] px-3 py-1 text-xs font-medium"
                style={annual === o.v ? { background: 'var(--fg)', color: 'var(--bg)' } : { color: 'var(--fg-2)' }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="mono text-[11px]" style={{ color: 'var(--ok)' }}>
            {PLAN_UI.monthsFree}
          </span>
        </div>
      )}
      <table className="w-full table-fixed border-separate border-spacing-0 text-[12.5px]">
        <colgroup>
          <col style={{ width: '34%' }} />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th />
            {TIERS.map((t) => {
              const pick = planInterest === t.id;
              return (
                <th key={t.id} className="rounded-t-[10px] border-b border-rule px-1 pb-2.5 align-bottom" style={hl(t.id)}>
                  <button
                    type="button"
                    onClick={() => onSetPlan(pick ? null : t.id)}
                    aria-pressed={pick}
                    className="relative flex w-full flex-col items-center gap-0.5 rounded-[10px] border border-transparent px-1 pb-1.5 pt-2 hover:border-rule"
                  >
                    {pick && (
                      <span
                        className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em]"
                        style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                      >
                        {PLAN_UI.theirPick}
                      </span>
                    )}
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-fg2">{t.name}</span>
                    <span className="font-display text-[26px] font-bold leading-none tabular-nums text-fg">
                      {annual ? t.annual : t.monthly}
                      <small className="ml-px font-body text-[11px] font-medium text-fg3">
                        {annual ? PLAN_UI.perYear : PLAN_UI.perMonth}
                      </small>
                    </span>
                    <span className="text-[10.5px] font-normal text-fg3">{t.setup}</span>
                    <span className="mt-0.5 text-[11px] font-normal leading-tight text-fg2">{t.line}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.label}>
              <td className="border-b py-2 pr-1.5 text-left text-fg2" style={{ borderColor: 'var(--rule-weak)' }}>
                <Hi text={r.label} q={q} />
              </td>
              {r.cells.map((c, i) => (
                <td
                  key={TIERS[i].id}
                  className={`border-b px-1.5 py-2 text-center ${ri === rows.length - 1 ? 'rounded-b-[10px]' : ''}`}
                  style={{ borderColor: 'var(--rule-weak)', ...hl(TIERS[i].id) }}
                >
                  <Cell cell={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!q && (
        <div className="flex flex-col gap-1 text-xs text-fg3">
          {PLAN_FOOTNOTES.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────  Objections  ───────────────────────────── */

interface AnswerCtx {
  q: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  calcOpen: boolean;
  setCalcOpen: (v: boolean) => void;
  calc: { calls: string; job: string; rec: string };
  setCalc: (v: { calls: string; job: string; rec: string }) => void;
  copied: boolean;
  copyDemo: () => void;
  showKeyPoint: (id: KeyPointId) => void;
  onAddToCalendar: () => void;
}

const LINK_CLS = 'inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium transition-colors';

function AnswerBody({ o, ctx }: { o: Objection; ctx: AnswerCtx }) {
  const links: ReactNode[] = [];
  if (o.answeredBy) {
    const kp = keyPoint(o.answeredBy);
    links.push(
      <button
        key="kp"
        type="button"
        onClick={() => ctx.showKeyPoint(kp.id)}
        className={LINK_CLS}
        style={{ color: 'var(--accent)', borderColor: 'rgba(31,111,120,0.35)', background: 'rgba(31,111,120,0.10)' }}
      >
        <Check size={13} weight="bold" /> {kp.title}
      </button>,
    );
  }
  if (o.demo) {
    links.push(
      <button key="demo" type="button" onClick={ctx.copyDemo} className={`${LINK_CLS} border-rule hover:text-[var(--accent)]`} style={{ background: 'var(--surface)' }}>
        <Phone size={13} /> {UI.demo} <span className="mono text-xs">{DEMO_LINE}</span>
        {ctx.copied && <Check size={12} weight="bold" style={{ color: 'var(--ok)' }} aria-label={UI.copied} />}
      </button>,
    );
  }
  if (o.calculator) {
    links.push(
      <button
        key="calc"
        type="button"
        aria-expanded={ctx.calcOpen}
        onClick={() => ctx.setCalcOpen(!ctx.calcOpen)}
        className={`${LINK_CLS} border-rule hover:text-[var(--accent)]`}
        style={ctx.calcOpen ? { color: 'var(--accent)', borderColor: 'var(--accent)', background: 'rgba(31,111,120,0.10)' } : { background: 'var(--surface)' }}
      >
        <Calculator size={13} /> {CALC_UI.open}
      </button>,
    );
  }
  if (o.calendar) {
    links.push(
      <button key="cal" type="button" onClick={ctx.onAddToCalendar} className={`${LINK_CLS} border-rule hover:text-[var(--accent)]`} style={{ background: 'var(--surface)' }}>
        <CalendarPlus size={13} /> {UI.addToCalendar}
      </button>,
    );
  }

  return (
    <div className="flex flex-col gap-2.5 px-3 pb-3 pt-0.5">
      <div className="rounded-r-[8px] border-l-[3px] px-3 py-2.5" style={{ borderColor: 'var(--accent-2)', background: 'var(--panel)' }}>
        <span className="meta mb-1 block" style={{ color: 'var(--accent-2)' }}>
          {UI.say}
        </span>
        <p className="text-[15px] font-semibold leading-[1.42] text-fg">
          <Hi text={o.answer} q={ctx.q} />
        </p>
        {o.followUp && <p className="mt-2 text-[13.5px] font-medium text-fg2">{o.followUp}</p>}
      </div>
      {links.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {o.answeredBy && <span className="meta mr-0.5">{UI.answeredBy}</span>}
          {links}
        </div>
      )}
      {o.calculator && ctx.calcOpen && <MissedCallsCalculator calc={ctx.calc} setCalc={ctx.setCalc} />}
    </div>
  );
}

function ObjectionList({ list, ctx }: { list: Objection[]; ctx: AnswerCtx }) {
  return (
    <div className="flex flex-col gap-1.5">
      {list.map((o) => {
        const open = ctx.openId === o.id;
        return (
          <div
            key={o.id}
            className="overflow-hidden rounded-[10px] border transition-colors"
            style={{
              borderColor: open ? 'var(--rule-strong)' : 'var(--rule)',
              background: open ? 'var(--surface)' : 'transparent',
            }}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => ctx.setOpenId(open ? null : o.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13.5px] font-medium text-fg hover:bg-[var(--surface)]"
            >
              <span className="min-w-0 flex-1">
                <Hi text={o.says} q={ctx.q} />
              </span>
              {o.tag && (
                <span className="rounded-full border border-rule px-2 py-px text-[10px] font-bold uppercase tracking-[0.08em] text-fg3">
                  {o.tag}
                </span>
              )}
              <CaretRight
                size={13}
                className="shrink-0 transition-transform"
                style={{ transform: open ? 'rotate(90deg)' : undefined, color: open ? 'var(--accent-2)' : 'var(--fg-3)' }}
              />
            </button>
            {open && <AnswerBody o={o} ctx={ctx} />}
          </div>
        );
      })}
    </div>
  );
}

function MissedCallsCalculator({
  calc,
  setCalc,
}: {
  calc: { calls: string; job: string; rec: string };
  setCalc: (v: { calls: string; job: string; rec: string }) => void;
}) {
  const out = calcOutcome(parseFloat(calc.calls) || 0, parseFloat(calc.job) || 0, calc.rec === '' ? 0 : parseFloat(calc.rec));
  const field = (id: 'calls' | 'job' | 'rec', label: string, placeholder: string) => (
    <label htmlFor={`sales-calc-${id}`} className="flex flex-col gap-1 text-[11px] font-medium text-fg2">
      {label}
      <input
        id={`sales-calc-${id}`}
        type="number"
        min={0}
        max={id === 'rec' ? 100 : undefined}
        inputMode="numeric"
        placeholder={placeholder}
        value={calc[id]}
        onChange={(e) => setCalc({ ...calc, [id]: e.target.value })}
        className="h-8 w-full rounded-[7px] border px-2 text-[13px] tabular-nums outline-none focus:border-[var(--accent)]"
        style={{ borderColor: 'var(--rule-strong)', background: 'var(--panel)' }}
      />
    </label>
  );
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-rule p-3" style={{ background: 'var(--surface)' }}>
      <div className="grid grid-cols-3 gap-2">
        {field('calls', CALC_UI.calls, '10')}
        {field('job', CALC_UI.job, '800')}
        {field('rec', CALC_UI.catchPct, '20')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[8px] p-2 text-center" style={{ background: 'var(--danger-glow)' }}>
          <span className="meta block">{CALC_UI.lost}</span>
          <b className="font-display text-2xl font-bold tabular-nums" style={{ color: 'var(--danger)' }}>
            {fmtDollars(out.lost)}
          </b>
        </div>
        <div className="rounded-[8px] p-2 text-center" style={{ background: 'var(--ok-glow)' }}>
          <span className="meta block">{CALC_UI.won}</span>
          <b className="font-display text-2xl font-bold tabular-nums" style={{ color: 'var(--ok)' }}>
            {fmtDollars(out.won)}
          </b>
        </div>
      </div>
      <span className="text-[11px] italic text-fg3">{CALC_UI.note}</span>
    </div>
  );
}

/* ─────────────────────────────  Search  ───────────────────────────── */

function SearchResultsView({
  results,
  ctx,
  annual,
  planInterest,
  onSetPlan,
}: {
  results: ReturnType<typeof searchSalesTool>;
  ctx: AnswerCtx;
  annual: boolean;
  planInterest: PlanInterest | null;
  onSetPlan: (plan: PlanInterest | null) => void;
}) {
  const { objections, keyPoints, planRows } = results;
  if (!objections.length && !keyPoints.length && !planRows.length) {
    return <p className="px-3 py-7 text-center text-[13px] text-fg3">{UI.none}</p>;
  }
  const head = (id: SalesTab) => (
    <h4 className="meta -mb-2 mt-1 text-[10.5px] uppercase tracking-[0.1em]">{TABS.find((t) => t.id === id)?.label}</h4>
  );
  return (
    <>
      {objections.length > 0 && (
        <>
          {head('objections')}
          <ObjectionList list={objections} ctx={ctx} />
        </>
      )}
      {keyPoints.length > 0 && (
        <>
          {head('system')}
          <div>
            {keyPoints.map((p) => (
              <KeyPointRow key={p.id} point={p} q={ctx.q} />
            ))}
          </div>
        </>
      )}
      {planRows.length > 0 && (
        <>
          {head('plans')}
          <PlansView rows={planRows} annual={annual} planInterest={planInterest} onSetPlan={onSetPlan} q={ctx.q} />
        </>
      )}
    </>
  );
}
