import { useState } from "react";
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
import { formatChartDate, formatCompactNumber, MACRO_CHART } from "../../../lib/macro-chart-utils";

type OnChainMetric = "hash_rate" | "tx_count";

interface OnChainChartProps {
  hashRateHistory: MacroSeriesPoint[];
  txCountHistory: MacroSeriesPoint[];
  hashRateChange7d: number | null;
  activityTrend: string;
}

const ACTIVITY_LABEL: Record<string, string> = {
  rising: "活発化",
  falling: "減速",
  stable: "横ばい",
};

export function OnChainChart({
  hashRateHistory,
  txCountHistory,
  hashRateChange7d,
  activityTrend,
}: OnChainChartProps) {
  const [metric, setMetric] = useState<OnChainMetric>("hash_rate");

  const series = metric === "hash_rate" ? hashRateHistory : txCountHistory;
  const data = series.map((p) => ({
    label: formatChartDate(p.ts),
    value: p.value,
  }));

  const color = metric === "hash_rate" ? MACRO_CHART.blue : MACRO_CHART.purple;
  const label = metric === "hash_rate" ? "ハッシュレート" : "トランザクション数";

  if (!data.length) {
    return <p className="text-sm text-content-muted">オンチェーン履歴なし</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-japanese text-sm font-medium text-slate-200">
          {ACTIVITY_LABEL[activityTrend] ?? activityTrend}
          {hashRateChange7d != null && metric === "hash_rate" && (
            <span className="ml-2 font-english text-xs text-content-secondary">
              7日 {hashRateChange7d > 0 ? "+" : ""}
              {hashRateChange7d}%
            </span>
          )}
        </p>
        <div className="flex rounded-lg border border-surface-border p-0.5">
          <button
            type="button"
            onClick={() => setMetric("hash_rate")}
            className={`min-h-[32px] rounded-md px-2.5 text-[10px] font-medium transition ${
              metric === "hash_rate"
                ? "bg-accent-blue text-white"
                : "text-content-secondary hover:text-slate-200"
            }`}
          >
            ハッシュレート
          </button>
          <button
            type="button"
            onClick={() => setMetric("tx_count")}
            className={`min-h-[32px] rounded-md px-2.5 text-[10px] font-medium transition ${
              metric === "tx_count"
                ? "bg-accent-blue text-white"
                : "text-content-secondary hover:text-slate-200"
            }`}
          >
            TX数
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="onchain-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
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
            width={44}
            tickFormatter={(v: number) => formatCompactNumber(v)}
          />
          <Tooltip
            contentStyle={{
              background: MACRO_CHART.tooltipBg,
              border: `1px solid ${MACRO_CHART.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [formatCompactNumber(value), label]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill="url(#onchain-gradient)"
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
