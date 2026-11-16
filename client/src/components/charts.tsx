/**
 * Chart components (recharts). Palette: validated categorical slots 1–4 (blue, orange, aqua, yellow),
 * assigned in fixed order and following the entity (never its rank). Contrast relief for aqua/yellow
 * is provided by always-visible legends with values and by tooltips/tables.
 */
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useI18n } from '@/i18n';

export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] as const;
const INK_MUTED = '#64748b';
const GRID = '#e2e8f0';
const SURFACE = '#ffffff';

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

function LegendList({ items, total }: { items: Slice[]; total?: number }) {
  return (
    <ul className="space-y-1.5 text-xs">
      {items.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
          <span className="text-slate-600 flex-1">{s.label}</span>
          <span className="font-semibold text-slate-900 tabular-nums">{s.value}</span>
          {total ? <span className="text-slate-400 tabular-nums w-10 text-right">{Math.round((s.value / total) * 100)}%</span> : null}
        </li>
      ))}
    </ul>
  );
}

function TooltipBox({ title, rows }: { title?: string; rows: { label: string; value: number | string; color: string }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs">
      {title && <div className="font-semibold text-slate-900 mb-1">{title}</div>}
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />
          <span className="text-slate-600">{r.label}</span>
          <span className="ml-auto pl-3 font-semibold text-slate-900 tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Donut for part-to-whole of a few states, with a legend that carries the values. */
export function DonutChart({ data, centerLabel }: { data: Slice[]; centerLabel: string }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const { t } = useI18n();
  if (!total) {
    return <div className="h-40 flex items-center justify-center text-xs text-slate-400">{t("Ma'lumot yo'q")}</div>;
  }
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative h-40 w-40 shrink-0" role="img" aria-label={`${centerLabel}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" stroke={SURFACE} strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox rows={[{ label: String(payload[0].name), value: `${payload[0].value} (${Math.round((Number(payload[0].value) / total) * 100)}%)`, color: (payload[0].payload as Slice).color }]} />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-900 tabular-nums">{total}</span>
          <span className="text-[10px] text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <div className="w-full">
        <LegendList items={data} total={total} />
      </div>
    </div>
  );
}

/** Weekly stacked columns (one axis, counts). */
export function WeeklyStackedChart({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
}) {
  const fmtWeek = (w: string) => {
    const d = new Date(`${w}T00:00:00`);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const totals = series.map((s) => ({ ...s, value: data.reduce((a, r) => a + Number(r[s.key] || 0), 0) }));
  const { t } = useI18n();
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs">
        {totals.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label} <strong className="text-slate-900 tabular-nums">{s.value}</strong>
          </span>
        ))}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="week" tickFormatter={fmtWeek} tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_MUTED }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.12)' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={`${t('Hafta')}: ${fmtWeek(String(label))}`}
                    rows={series.map((s) => ({ label: s.label, value: Number((payload[0].payload as any)[s.key] || 0), color: s.color }))}
                  />
                ) : null
              }
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="a"
                fill={s.color}
                stroke={SURFACE}
                strokeWidth={2}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={false}
                maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Horizontal bars for comparing one measure across named items (single series). */
export function HorizontalBars({
  data,
  unit = '',
  max,
  color = SERIES[0],
  emptyText,
}: {
  data: { label: string; value: number | null; sub?: string }[];
  unit?: string;
  max?: number;
  color?: string;
  emptyText?: string;
}) {
  const { t } = useI18n();
  const valid = data.filter((d) => d.value !== null);
  if (!valid.length) return <div className="py-8 text-center text-xs text-slate-400">{emptyText ?? t("Ma'lumot yo'q")}</div>;
  const top = max ?? Math.max(...valid.map((d) => d.value as number), 1);
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label} title={d.value === null ? '' : `${d.label}: ${d.value}${unit}`}>
          <div className="flex items-baseline justify-between text-xs mb-1 gap-2">
            <span className="font-medium text-slate-700 truncate">
              {d.label}
              {d.sub && <span className="text-slate-400 font-normal"> · {d.sub}</span>}
            </span>
            <span className="font-semibold text-slate-900 tabular-nums shrink-0">{d.value === null ? '—' : `${d.value}${unit}`}</span>
          </div>
          <div className="h-2 rounded bg-slate-100 overflow-hidden">
            {d.value !== null && <div className="h-full rounded-r" style={{ width: `${Math.max(2, (d.value / top) * 100)}%`, background: color }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
