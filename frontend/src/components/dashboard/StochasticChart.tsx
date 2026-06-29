import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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

interface StochRow {
  label: string;
  k: number;
  d: number;
  spread: number;
  cross: "gc" | "dc" | null;
}

function StochTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: StochRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const spreadLabel =
    row.spread > 0.5 ? "KがDより上（強気）" : row.spread < -0.5 ? "KがDより下（弱気）" : "K≈D";
  return (
    <div className="rounded-lg border border-surface-border bg-surface-hover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-content-secondary">{label}</p>
      <p className="font-english text-slate-100">%K {row.k.toFixed(1)} / %D {row.d.toFixed(1)}</p>
      <p className="mt-1 text-content-muted">
        乖離 {row.spread >= 0 ? "+" : ""}
        {row.spread.toFixed(1)} — {spreadLabel}
      </p>
      {row.cross ? (
        <p className={`mt-1 font-medium ${row.cross === "gc" ? "text-accent-green" : "text-accent-red"}`}>
          {row.cross === "gc" ? "ゴールデンクロス" : "デッドクロス"}
        </p>
      ) : null}
    </div>
  );
}

export function StochasticChart({ series, k, d, lastCross }: StochasticChartProps) {
  const data: StochRow[] = useMemo(
    () =>
      series.map((p) => ({
        label: formatChartDate(p.ts),
        k: p.k,
        d: p.d,
        spread: p.k - p.d,
        cross: p.cross,
      })),
    [series],
  );

  const crossPoints = data.filter((p) => p.cross === "gc" || p.cross === "dc");
  const recentCrosses = crossPoints.slice(-4).reverse();

  if (!data.length) {
    return <p className="text-sm text-content-muted">ストキャスデータがありません</p>;
  }

  const spreadNow = k != null && d != null ? k - d : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="font-english text-sm text-slate-200">
            %K{" "}
            <span className="font-semibold text-cyan-300">{k?.toFixed(1) ?? "—"}</span>
            <span className="mx-2 text-content-muted">/</span>
            %D <span className="font-semibold text-orange-300">{d?.toFixed(1) ?? "—"}</span>
          </p>
          {spreadNow != null ? (
            <span
              className={`font-english text-xs ${
                spreadNow > 0 ? "text-accent-green" : spreadNow < 0 ? "text-accent-red" : "text-content-muted"
              }`}
            >
              乖離 {spreadNow >= 0 ? "+" : ""}
              {spreadNow.toFixed(1)}
            </span>
          ) : null}
        </div>
        {lastCross ? (
          <span
            className={`rounded-full px-2 py-0.5 font-japanese text-[10px] font-medium ${
              lastCross === "gc"
                ? "bg-accent-green/15 text-accent-green"
                : "bg-accent-red/15 text-accent-red"
            }`}
          >
            直近{lastCross === "gc" ? "GC" : "DC"}
          </span>
        ) : null}
      </div>

      <ResponsiveContainer width="100%" height={228}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={MACRO_CHART.grid} vertical={false} />
          <ReferenceArea y1={80} y2={100} fill={MACRO_CHART.red} fillOpacity={0.1} />
          <ReferenceArea y1={0} y2={20} fill={MACRO_CHART.green} fillOpacity={0.1} />
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
          <Tooltip content={<StochTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value) =>
              value === "kLine" ? "%K（実線）" : value === "dLine" ? "%D（点線）" : value
            }
          />
          <Line
            type="monotone"
            dataKey="k"
            name="kLine"
            stroke="#22d3ee"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#22d3ee", stroke: "#fff", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="d"
            name="dLine"
            stroke="#fb923c"
            strokeWidth={2}
            strokeDasharray="7 4"
            dot={{ r: 2, fill: "#fb923c", strokeWidth: 0 }}
            activeDot={{ r: 3, fill: "#fb923c", stroke: "#fff", strokeWidth: 1 }}
          />
          {crossPoints.map((p) => (
            <ReferenceDot
              key={`${p.label}-${p.cross}`}
              x={p.label}
              y={p.k}
              r={9}
              fill={p.cross === "gc" ? MACRO_CHART.green : MACRO_CHART.red}
              stroke="#fff"
              strokeWidth={2}
              label={{
                value: p.cross === "gc" ? "GC" : "DC",
                position: p.cross === "gc" ? "top" : "bottom",
                fill: p.cross === "gc" ? "#86efac" : "#fca5a5",
                fontSize: 9,
                fontWeight: 700,
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-2">
        <p className="mb-1 font-japanese text-[9px] text-content-muted">%K−%D 乖離（緑=K上・赤=K下）</p>
        <div className="flex h-3 gap-px overflow-hidden rounded-sm bg-surface-border/40">
          {data.map((p) => {
            const intensity = Math.min(1, Math.abs(p.spread) / 12 + 0.25);
            return (
              <div
                key={p.label}
                className="min-w-[3px] flex-1"
                style={{
                  backgroundColor: p.spread >= 0 ? `rgba(34, 197, 94, ${intensity})` : `rgba(239, 68, 68, ${intensity})`,
                }}
                title={`${p.label}: 乖離 ${p.spread >= 0 ? "+" : ""}${p.spread.toFixed(1)}`}
              />
            );
          })}
        </div>
      </div>

      {recentCrosses.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {recentCrosses.map((p) => (
            <li
              key={`${p.label}-${p.cross}`}
              className={`rounded-md px-2 py-0.5 font-japanese text-[10px] ${
                p.cross === "gc"
                  ? "bg-accent-green/10 text-accent-green"
                  : "bg-accent-red/10 text-accent-red"
              }`}
            >
              {p.label} {p.cross === "gc" ? "GC" : "DC"}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 font-japanese text-[10px] text-content-muted">
        実線=%K・オレンジ点線=%D。乖離ストリップの色が切り替わる点がクロス付近です。GC/DCは丸印＋ラベルで表示します。
      </p>
    </div>
  );
}
