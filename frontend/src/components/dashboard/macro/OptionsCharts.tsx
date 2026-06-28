import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MacroSeriesPoint } from "../../../lib/macro-chart-utils";
import { formatChartDate, MACRO_CHART } from "../../../lib/macro-chart-utils";

interface DvolChartProps {
  history: MacroSeriesPoint[];
  current: number | null;
}

export function DvolChart({ history, current }: DvolChartProps) {
  const data = history.map((p) => ({
    label: formatChartDate(p.ts),
    dvol: p.value,
  }));

  if (!data.length) {
    return <p className="text-sm text-slate-500">DVOL履歴なし</p>;
  }

  const v = current ?? data[data.length - 1]?.dvol ?? 50;
  const color = v >= 55 ? MACRO_CHART.red : v <= 40 ? MACRO_CHART.green : MACRO_CHART.amber;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-english text-2xl font-semibold" style={{ color }}>
          {v.toFixed(1)}
        </p>
        <p className="font-japanese text-xs text-slate-500">DVOL（ボラティリティ指数）</p>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dvol-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={MACRO_CHART.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: MACRO_CHART.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: MACRO_CHART.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: MACRO_CHART.tooltipBg,
              border: `1px solid ${MACRO_CHART.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [value.toFixed(2), "DVOL"]}
          />
          <Area
            type="monotone"
            dataKey="dvol"
            stroke={color}
            strokeWidth={2}
            fill="url(#dvol-gradient)"
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface PutCallOiBarProps {
  putOi: number;
  callOi: number;
  ratio: number;
}

/** Semicircle gauge: low ratio = bullish (calls), high = bearish (puts) */
function PutCallGauge({ ratio }: { ratio: number }) {
  const min = 0.4;
  const max = 1.2;
  const clamped = Math.min(max, Math.max(min, ratio));
  const pct = (clamped - min) / (max - min);
  const cx = 100;
  const cy = 88;
  const r = 62;
  const angle = Math.PI - pct * Math.PI;
  const nx = cx + 48 * Math.cos(angle);
  const ny = cy - 48 * Math.sin(angle);
  const color = ratio >= 1.0 ? MACRO_CHART.red : ratio <= 0.7 ? MACRO_CHART.green : MACRO_CHART.amber;

  return (
    <svg viewBox="0 0 200 108" className="mx-auto w-full max-w-[220px]" aria-hidden>
      <defs>
        <linearGradient id="pc-gauge" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={MACRO_CHART.green} />
          <stop offset="50%" stopColor={MACRO_CHART.amber} />
          <stop offset="100%" stopColor={MACRO_CHART.red} />
        </linearGradient>
      </defs>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="url(#pc-gauge)"
        strokeWidth={12}
        strokeLinecap="round"
      />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={nx} cy={ny} r={10} fill={color} />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700} className="font-english">
        {ratio.toFixed(2)}
      </text>
      <circle cx={cx} cy={cy} r={8} fill="#475569" />
      <text x={cx - r - 2} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize={8} className="font-japanese">
        Call優勢
      </text>
      <text x={cx + r + 2} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize={8} className="font-japanese">
        Put優勢
      </text>
    </svg>
  );
}

export function PutCallOiChart({ putOi, callOi, ratio }: PutCallOiBarProps) {
  const total = putOi + callOi || 1;
  const putPct = Math.round((putOi / total) * 100);
  const callPct = 100 - putPct;

  return (
    <div className="space-y-4">
      <PutCallGauge ratio={ratio} />
      <p className="text-center font-japanese text-xs text-slate-400">
        Put/Call OI比{" "}
        <span className="font-english font-semibold text-slate-200">{ratio.toFixed(2)}</span>
      </p>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-japanese text-emerald-400">Call OI</span>
          <span className="font-english text-slate-300">{callOi.toLocaleString()} ({callPct}%)</span>
        </div>
        <div className="flex h-6 overflow-hidden rounded-md bg-slate-800">
          <div
            className="bg-emerald-600/80 transition-all"
            style={{ width: `${callPct}%` }}
            title={`Call ${callPct}%`}
          />
          <div
            className="bg-red-600/80 transition-all"
            style={{ width: `${putPct}%` }}
            title={`Put ${putPct}%`}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-japanese text-red-400">Put OI</span>
          <span className="font-english text-slate-300">{putOi.toLocaleString()} ({putPct}%)</span>
        </div>
      </div>
    </div>
  );
}
