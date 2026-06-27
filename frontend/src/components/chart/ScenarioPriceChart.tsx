import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { buildEntryGuide } from "../../lib/entry-guide";
import type { EntryZone, ExitStrategy, ForecastPoint, TradeSide } from "../../types/scenario";

interface PricePoint {
  ts: string;
  price: number;
}

const SIDE_LABEL: Record<TradeSide, string> = {
  long: "ロング",
  short: "ショート",
  neutral: "様子見",
};

const STATUS_BADGE: Record<string, string> = {
  in_zone: "bg-accent-blue/20 text-accent-blue",
  wait_pullback: "bg-accent-amber/20 text-amber-200",
  wait_rally: "bg-accent-amber/20 text-amber-200",
  passed: "bg-slate-700 text-slate-300",
  neutral: "bg-slate-700 text-slate-400",
};

interface ChartRow {
  ts: string;
  kind: "past" | "now" | "future";
  pastPrice: number | null;
  futurePrice: number | null;
}

interface ScenarioPriceChartProps {
  history: PricePoint[];
  currentPrice: number;
  openedAt: Date;
  forecast: ForecastPoint[];
  entry: EntryZone;
  exit: ExitStrategy;
}

function formatOpenedAt(d: Date): string {
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildChartRows(
  history: PricePoint[],
  currentPrice: number,
  forecast: ForecastPoint[],
): ChartRow[] {
  const past = history.slice(-5).map((h) => ({
    ts: h.ts,
    kind: "past" as const,
    pastPrice: h.price,
    futurePrice: null,
  }));

  const nowRow: ChartRow = {
    ts: "いま",
    kind: "now",
    pastPrice: currentPrice,
    futurePrice: currentPrice,
  };

  const future = forecast.map((f, i) => ({
    ts: `+${i + 1}時間`,
    kind: "future" as const,
    pastPrice: null,
    futurePrice: f.price,
  }));

  return [...past, nowRow, ...future];
}

export function ScenarioPriceChart({
  history,
  currentPrice,
  openedAt,
  forecast,
  entry,
  exit,
}: ScenarioPriceChartProps) {
  const entryLow = Math.min(entry.zone_low, entry.zone_high);
  const entryHigh = Math.max(entry.zone_low, entry.zone_high);
  const guide = buildEntryGuide(
    currentPrice,
    entry.zone_low,
    entry.zone_high,
    entry.side,
    exit.stop_loss,
    exit.take_profit,
  );

  const chartData = buildChartRows(history, currentPrice, forecast);
  const badgeClass = STATUS_BADGE[guide.status] ?? STATUS_BADGE.neutral;

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-400">エントリー判断と価格の流れ</h2>
          <p className="mt-1 text-xs text-slate-500">
            {formatOpenedAt(openedAt)} 時点 — 左が過去、右が6時間先の目安
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}>
            {guide.headline}
          </span>
          <span className="text-xs text-slate-500">{SIDE_LABEL[entry.side]}</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-surface-border/60 bg-surface/50 px-4 py-3">
        <div>
          <p className="text-[10px] text-slate-500">いまの価格</p>
          <p className="font-english text-xl font-semibold text-white">
            ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="text-sm text-slate-400">
          <p>{guide.detail}</p>
          <p className="mt-1 text-xs text-slate-500">{guide.action}</p>
        </div>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="ts"
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={chartData.length > 10 ? -25 : 0}
              textAnchor={chartData.length > 10 ? "end" : "middle"}
              height={chartData.length > 10 ? 50 : 30}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              domain={["auto", "auto"]}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
              formatter={(value, name) => {
                if (value == null || typeof value !== "number") return [null, null];
                const label = name === "pastPrice" ? "過去" : "予測";
                return [`$${value.toLocaleString()}`, label];
              }}
              labelFormatter={(label) => (label === "いま" ? "いま（アプリを開いた時点）" : label)}
            />
            <ReferenceArea
              y1={entryLow}
              y2={entryHigh}
              fill="#3b82f6"
              fillOpacity={0.18}
              label={{ value: "エントリー帯", fill: "#93c5fd", fontSize: 11 }}
            />
            <ReferenceLine
              x="いま"
              stroke="#ffffff"
              strokeWidth={2}
              label={{ value: "いま", fill: "#e2e8f0", fontSize: 10, position: "top" }}
            />
            {exit.take_profit.map((tp, i) => (
              <ReferenceLine
                key={`tp-${i}`}
                y={tp}
                stroke="#22c55e"
                strokeDasharray="4 4"
                label={{ value: `TP${i + 1}`, fill: "#86efac", fontSize: 10 }}
              />
            ))}
            <ReferenceLine
              y={exit.stop_loss}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: "SL", fill: "#fca5a5", fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="pastPrice"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={{ r: 3, fill: "#60a5fa" }}
              connectNulls={false}
              name="過去"
            />
            <Line
              type="monotone"
              dataKey="futurePrice"
              stroke="#a78bfa"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={(props) => {
                const { cx, cy, payload } = props as {
                  cx: number;
                  cy: number;
                  payload: ChartRow;
                };
                if (payload?.kind !== "now" && payload?.kind !== "future") return <g key="empty" />;
                const isNow = payload.kind === "now";
                return (
                  <circle
                    key={payload.ts}
                    cx={cx}
                    cy={cy}
                    r={isNow ? 6 : 4}
                    fill={isNow ? "#fff" : "#a78bfa"}
                    stroke={isNow ? "#a78bfa" : "none"}
                    strokeWidth={isNow ? 2 : 0}
                  />
                );
              }}
              connectNulls={false}
              name="予測"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-surface-border/60 pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">エントリー帯</dt>
          <dd className="font-english text-slate-200">
            ${entryLow.toLocaleString()} – ${entryHigh.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">利確（TP）</dt>
          <dd className="font-english text-accent-green">
            {exit.take_profit.map((p) => `$${p.toLocaleString()}`).join(" / ")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">損切り（SL）</dt>
          <dd className="font-english text-accent-red">${exit.stop_loss.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">有効目安</dt>
          <dd className="text-slate-300">開いてから約6時間</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-slate-500">
        青い実線＝過去の推移　紫の点線＝いまから6時間先の目安（白丸＝いま）　青い帯＝エントリー候補
      </p>
    </section>
  );
}
