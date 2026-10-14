'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money, monthLabel, monthShort } from '@/lib/financeFormat';

/**
 * Income bars with a net-profit line traced over them, month by month across the tax year.
 *
 * ── Why this form ───────────────────────────────────────────────────────────────────────────
 *
 * Gross revenue is the bar; net profit is the line. The visible gap between them is what the
 * business costs to run, and the line is the number that actually drives the tax — so the shape
 * answers "how am I doing" and "what will I owe" in one read.
 *
 * ── Interaction ─────────────────────────────────────────────────────────────────────────────
 *
 * Hover gives exact figures. Clicking a month filters the ledger tables below it, which is the
 * feature that earns the dependency: "October looks expensive, what was it?" is one click rather
 * than a scroll and a scan.
 *
 * Zoom was specced and deliberately left out. Twelve bars have nothing to zoom into; a Brush
 * would add a second control and a second piece of state to serve a gesture that cannot reveal
 * anything the full year doesn't already show. It becomes worth adding the moment this chart
 * spans multiple years.
 */

export interface ChartPoint {
  month: string;
  grossCents: number;
  expensesCents: number;
  netCents: number;
}

interface Props {
  data: ChartPoint[];
  selectedMonth: string | null;
  onSelectMonth: (month: string | null) => void;
}

/** Chart colors read from the console's own tokens so the chart can't drift from the chrome. */
const INCOME = 'var(--accent)';
const NET = 'var(--fg)';

export default function MonthlyChart({ data, selectedMonth, onSelectMonth }: Props) {
  const rows = data.map((d) => ({
    ...d,
    gross: d.grossCents / 100,
    expenses: d.expensesCents / 100,
    net: d.netCents / 100,
  }));

  const hasAnything = rows.some((r) => r.gross !== 0 || r.expenses !== 0);

  if (!hasAnything) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-[10px] border border-dashed border-rule">
        <p className="text-xs text-fg3">
          No income or expenses recorded for this year yet.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          onClick={(state: { activeLabel?: string | number }) => {
            const month = state?.activeLabel;
            if (typeof month !== 'string') return;
            // Clicking the selected month again clears the filter — the same gesture both ways,
            // so there's no hunting for a separate "show all" control.
            onSelectMonth(month === selectedMonth ? null : month);
          }}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={monthShort}
            tick={{ fontSize: 11, fill: 'var(--fg-3)' }}
            axisLine={{ stroke: 'var(--rule)' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) =>
              v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`
            }
            tick={{ fontSize: 11, fill: 'var(--fg-3)' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={<ChartTooltip />}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'var(--fg-2)' }}
          />
          <Bar
            dataKey="gross"
            name="Income"
            fill={INCOME}
            radius={[3, 3, 0, 0]}
            maxBarSize={34}
            isAnimationActive={false}
          />
          <Line
            dataKey="net"
            name="Net profit"
            type="monotone"
            stroke={NET}
            strokeWidth={2}
            dot={{ r: 2.5, fill: NET }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-[8px] border border-rule bg-[var(--panel)] px-3 py-2 shadow-sm">
      <p className="mb-1 text-xs font-medium">{monthLabel(label ?? p.month)}</p>
      <dl className="space-y-0.5 text-xs tabular-nums">
        <Line2 label="Income" value={money(p.grossCents)} />
        <Line2 label="Expenses" value={money(p.expensesCents)} />
        <Line2 label="Net" value={money(p.netCents)} strong />
      </dl>
      <p className="meta mt-1.5 text-fg3">click to filter below</p>
    </div>
  );
}

function Line2({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <dt className="text-fg2">{label}</dt>
      <dd className={strong ? 'font-semibold' : ''}>{value}</dd>
    </div>
  );
}
