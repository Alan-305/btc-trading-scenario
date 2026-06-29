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
import type { AlignedStochRow } from "../../lib/align-stoch-history";

const STOCH_HEIGHT = 132;
const CHART_LEFT = 56;

interface EntryStochasticPaneProps {
  data: AlignedStochRow[];
  width: number;
  showXAxis?: boolean;
}

function StochPaneTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: AlignedStochRow & { spread?: number } }>;
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

export function EntryStochasticPane({ data, width, showXAxis = true }: EntryStochasticPaneProps) {
  const plotData = data.map((row) => ({
    ...row,
    spread: row.k != null && row.d != null ? row.k - row.d : null,
  }));
  const crossPoints = plotData.filter((p) => p.cross && p.k != null);

  if (!plotData.some((p) => p.k != null)) {
    return (
      <div
        className="flex items-center justify-center border-t border-surface-border/40 bg-surface/20 text-xs text-content-muted"
        style={{ width, height: STOCH_HEIGHT }}
      >
        ストキャス（4時間足）データなし
      </div>
    );
  }

  return (
    <div className="relative border-t border-surface-border/40 bg-surface/20" style={{ width, height: STOCH_HEIGHT }}>
      <p className="absolute left-14 top-1 z-10 font-japanese text-[10px] text-content-muted">
        ストキャス（14,3,3）
      </p>
      <ComposedChart
        width={width}
        height={STOCH_HEIGHT}
        data={plotData}
        margin={{ top: 18, right: 72, left: CHART_LEFT, bottom: showXAxis ? 8 : 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
        <ReferenceArea y1={80} y2={100} fill="#ef4444" fillOpacity={0.08} />
        <ReferenceArea y1={0} y2={20} fill="#22c55e" fillOpacity={0.08} />
        <XAxis
          dataKey="ts"
          hide={!showXAxis}
          stroke="#94a3b8"
          tick={{ fontSize: 9 }}
          interval={0}
          angle={-55}
          textAnchor="end"
          height={showXAxis ? 72 : 0}
          tickMargin={4}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[20, 80]}
          stroke="#94a3b8"
          tick={{ fontSize: 9 }}
          width={36}
          tickFormatter={(v) => `${v}`}
        />
        <Tooltip content={<StochPaneTooltip />} />
        <ReferenceLine x="いま" stroke="#ffffff" strokeWidth={1} strokeOpacity={0.35} />
        <Line
          type="monotone"
          dataKey="k"
          stroke="#22d3ee"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="d"
          stroke="#fb923c"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          dot={false}
          connectNulls={false}
        />
        {crossPoints.map((p) => (
          <ReferenceDot
            key={`${p.ts}-${p.cross}`}
            x={p.ts}
            y={p.k!}
            r={7}
            fill={p.cross === "gc" ? "#22c55e" : "#ef4444"}
            stroke="#fff"
            strokeWidth={1.5}
            label={{
              value: p.cross === "gc" ? "GC" : "DC",
              position: p.cross === "gc" ? "top" : "bottom",
              fill: p.cross === "gc" ? "#86efac" : "#fca5a5",
              fontSize: 8,
              fontWeight: 700,
            }}
          />
        ))}
      </ComposedChart>
    </div>
  );
}

export const ENTRY_STOCH_HEIGHT = STOCH_HEIGHT;
export const ENTRY_STOCH_XAXIS_HEIGHT = 72;
