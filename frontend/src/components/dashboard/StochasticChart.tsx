import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StochSeriesPoint } from "../../types/market";
import { formatChartDate, MACRO_CHART } from "../../lib/macro-chart-utils";

interface StochasticChartProps {
  series: StochSeriesPoint[];
  k: number | null;
  d: number | null;
  lastCross: "gc" | "dc" | null;
}

export function StochasticChart({ series, k, d, lastCross }: StochasticChartProps) {
  const data = series.map((p) => ({
    label: formatChartDate(p.ts),
    k: p.k,
    d: p.d,
    cross: p.cross,
  }));

  if (!data.length) {
    return <p className="text-sm text-content-muted">ストキャスデータがありません</p>;
  }

  const crossPoints = data.filter((p) => p.cross === "gc" || p.cross === "dc");

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="font-english text-sm text-slate-200">
          %K <span className="font-semibold text-blue-300">{k?.toFixed(1) ?? "—"}</span>
          <span className="mx-2 text-content-muted">/</span>
          %D <span className="font-semibold text-amber-200">{d?.toFixed(1) ?? "—"}</span>
        </p>
        {lastCross && (
          <span
            className={`rounded-full px-2 py-0.5 font-japanese text-[10px] font-medium ${
              lastCross === "gc"
                ? "bg-accent-green/15 text-accent-green"
                : "bg-accent-red/15 text-accent-red"
            }`}
          >
            直近{lastCross === "gc" ? "GC" : "DC"}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={MACRO_CHART.grid} vertical={false} />
          <ReferenceArea y1={80} y2={100} fill={MACRO_CHART.red} fillOpacity={0.08} />
          <ReferenceArea y1={0} y2={20} fill={MACRO_CHART.green} fillOpacity={0.08} />
          <XAxis
            dataKey="label"
            tick={{ fill: MACRO_CHART.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 20, 50, 80, 100]}
            tick={{ fill: MACRO_CHART.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: MACRO_CHART.tooltipBg,
              border: `1px solid ${MACRO_CHART.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value) => (value === "k" ? "%K" : "%D")}
          />
          <Line type="monotone" dataKey="k" name="k" stroke={MACRO_CHART.blue} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="d" name="d" stroke={MACRO_CHART.amber} strokeWidth={2} dot={false} />
          {crossPoints.map((p) => (
            <ReferenceDot
              key={`${p.label}-${p.cross}`}
              x={p.label}
              y={p.cross === "gc" ? p.k : p.k}
              r={5}
              fill={p.cross === "gc" ? MACRO_CHART.green : MACRO_CHART.red}
              stroke="#fff"
              strokeWidth={1}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 font-japanese text-[10px] text-content-muted">
        緑帯=売られすぎ（20以下）・赤帯=買われすぎ（80以上）。GC/DCマーカーはクロス発生足です。
      </p>
    </div>
  );
}
