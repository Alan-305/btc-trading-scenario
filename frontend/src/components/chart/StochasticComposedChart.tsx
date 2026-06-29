import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { stochYDomain } from "../../lib/stoch-y-domain";

export interface StochChartRow {
  label: string;
  k: number | null;
  d: number | null;
  cross: "gc" | "dc" | null;
}

const CHART_LEFT = 56;

function StochTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: StochChartRow & { spread?: number | null } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row || row.k == null || row.d == null) return null;
  const spread = row.k - row.d;
  return (
    <div className="rounded-lg border border-surface-border bg-surface-hover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-content-secondary">{label}</p>
      <p className="font-english text-slate-100">
        %K {row.k.toFixed(1)} / %D {row.d.toFixed(1)}
      </p>
      {row.cross ? (
        <p className={`mt-1 font-medium ${row.cross === "gc" ? "text-accent-green" : "text-accent-red"}`}>
          {row.cross === "gc" ? "GC" : "DC"}
        </p>
      ) : (
        <p className="mt-1 text-content-muted">
          乖離 {spread >= 0 ? "+" : ""}
          {spread.toFixed(1)}
        </p>
      )}
    </div>
  );
}

interface StochasticComposedChartProps {
  data: StochChartRow[];
  width: number;
  height: number;
  showXAxis?: boolean;
  xAxisHeight?: number;
  nowMarkerLabel?: string | null;
  caption?: string;
}

export function StochasticComposedChart({
  data,
  width,
  height,
  showXAxis = true,
  xAxisHeight = 72,
  nowMarkerLabel = null,
  caption = "ストキャス（14,3,3）— %K 水色 / %D オレンジ",
}: StochasticComposedChartProps) {
  const plotData = useMemo(
    () =>
      data.map((row) => ({
        ...row,
        spread: row.k != null && row.d != null ? row.k - row.d : null,
      })),
    [data],
  );
  const crossPoints = plotData.filter((p) => p.cross && p.k != null);
  const yDomain = useMemo(() => stochYDomain(plotData), [plotData]);
  const xAxisBand = showXAxis ? xAxisHeight : 0;
  const chartHeight = height + xAxisBand;

  if (!plotData.some((p) => p.k != null)) {
    return (
      <div
        className="flex items-center justify-center text-xs text-content-muted"
        style={{ width, height: chartHeight }}
      >
        ストキャスデータなし
      </div>
    );
  }

  const showOb = yDomain[0] <= 20;
  const showOs = yDomain[1] >= 80;

  return (
    <div className="relative" style={{ width, height: chartHeight }}>
      {caption ? (
        <p className="absolute left-14 top-2 z-10 font-japanese text-[10px] text-content-muted">{caption}</p>
      ) : null}
      <ComposedChart
        width={width}
        height={chartHeight}
        data={plotData}
        margin={{ top: 22, right: 72, left: CHART_LEFT, bottom: showXAxis ? xAxisBand : 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
        {showOs ? <ReferenceArea y1={80} y2={100} fill="#ef4444" fillOpacity={0.1} /> : null}
        {showOb ? <ReferenceArea y1={0} y2={20} fill="#22c55e" fillOpacity={0.1} /> : null}
        {yDomain[0] <= 20 && yDomain[1] >= 20 ? (
          <ReferenceLine y={20} stroke="#64748b" strokeDasharray="4 4" strokeOpacity={0.5} />
        ) : null}
        {yDomain[0] <= 80 && yDomain[1] >= 80 ? (
          <ReferenceLine y={80} stroke="#64748b" strokeDasharray="4 4" strokeOpacity={0.5} />
        ) : null}
        <XAxis
          dataKey="label"
          hide={!showXAxis}
          stroke="#94a3b8"
          tick={{ fontSize: 9 }}
          interval={width > 600 ? "preserveStartEnd" : 0}
          angle={showXAxis && width <= 600 ? -55 : 0}
          textAnchor={showXAxis && width <= 600 ? "end" : "middle"}
          height={xAxisBand}
          tickMargin={4}
        />
        <YAxis
          domain={yDomain}
          allowDataOverflow
          stroke="#94a3b8"
          tick={{ fontSize: 10 }}
          width={40}
          tickCount={6}
        />
        <Tooltip content={<StochTooltip />} />
        {nowMarkerLabel ? (
          <ReferenceLine x={nowMarkerLabel} stroke="#ffffff" strokeWidth={1} strokeOpacity={0.35} />
        ) : null}
        <Line
          type="monotone"
          dataKey="k"
          name="%K"
          stroke="#22d3ee"
          strokeWidth={2.5}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="d"
          name="%D"
          stroke="#fb923c"
          strokeWidth={2.5}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        {crossPoints.map((p) => (
          <ReferenceDot
            key={`${p.label}-${p.cross}`}
            x={p.label}
            y={p.k!}
            r={8}
            fill={p.cross === "gc" ? "#22c55e" : "#ef4444"}
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
    </div>
  );
}

export const STOCH_PLOT_HEIGHT = 240;
