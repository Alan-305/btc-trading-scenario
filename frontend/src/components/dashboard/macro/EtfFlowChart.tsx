import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MacroSeriesPoint } from "../../../lib/macro-chart-utils";
import { formatChartDate, formatCompactUsd, MACRO_CHART } from "../../../lib/macro-chart-utils";

interface EtfFlowChartProps {
  dailyFlows: MacroSeriesPoint[];
  trend: string;
  netFlow3d: number | null;
}

export function EtfFlowChart({ dailyFlows, trend, netFlow3d }: EtfFlowChartProps) {
  const data = dailyFlows.map((p) => ({
    label: formatChartDate(p.ts),
    flow: p.value,
  }));

  if (!data.length) {
    return <p className="text-sm text-slate-500">フロー履歴なし</p>;
  }

  const trendLabel =
    trend === "inflow" ? "流入傾向" : trend === "outflow" ? "流出傾向" : "中立";

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="font-japanese text-sm font-medium text-slate-200">{trendLabel}</p>
        <p className="font-english text-xs text-slate-400">
          3日合計 {netFlow3d != null ? formatCompactUsd(netFlow3d) : "—"}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={MACRO_CHART.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: MACRO_CHART.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: MACRO_CHART.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) => formatCompactUsd(v)}
          />
          <ReferenceLine y={0} stroke={MACRO_CHART.axis} />
          <Tooltip
            contentStyle={{
              background: MACRO_CHART.tooltipBg,
              border: `1px solid ${MACRO_CHART.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [formatCompactUsd(value), "推定フロー"]}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Bar dataKey="flow" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {data.map((entry) => (
              <Cell
                key={entry.label}
                fill={entry.flow >= 0 ? MACRO_CHART.green : MACRO_CHART.red}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 font-japanese text-[10px] text-slate-500">
        緑=流入推定 / 赤=流出推定（日次・USD）
      </p>
    </div>
  );
}
