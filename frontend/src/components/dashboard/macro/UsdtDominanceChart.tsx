import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MacroSeriesPoint } from "../../../lib/macro-chart-utils";
import { formatChartDate, MACRO_CHART } from "../../../lib/macro-chart-utils";

interface UsdtDominanceChartProps {
  history: MacroSeriesPoint[];
  current: number;
  change7d: number | null;
  trend: string;
}

export function UsdtDominanceChart({
  history,
  current,
  change7d,
  trend,
}: UsdtDominanceChartProps) {
  const data = history.map((p) => ({
    label: formatChartDate(p.ts),
    dominance: p.value,
  }));

  if (!data.length) {
    return <p className="text-sm text-content-muted">履歴なし</p>;
  }

  const trendLabel =
    trend === "rising" ? "上昇傾向" : trend === "falling" ? "低下傾向" : "横ばい";

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="font-english text-lg font-semibold text-slate-100">{current.toFixed(2)}%</p>
        <p className="font-japanese text-xs text-content-secondary">
          {trendLabel}
          {change7d != null ? `（7日 ${change7d >= 0 ? "+" : ""}${change7d.toFixed(2)}pt）` : ""}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
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
            width={42}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          />
          <Tooltip
            contentStyle={{
              background: MACRO_CHART.tooltipBg,
              border: `1px solid ${MACRO_CHART.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value.toFixed(3)}%`, "USDT.D"]}
          />
          <ReferenceLine y={current} stroke={MACRO_CHART.amber} strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="dominance"
            stroke={MACRO_CHART.blue}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
