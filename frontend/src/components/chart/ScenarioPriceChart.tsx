import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { EntryStochasticPane, ENTRY_STOCH_HEIGHT } from "./EntryStochasticPane";
import { alignStochToChartRows } from "../../lib/align-stoch-history";
import { alignMacroEventsToChartRows } from "../../lib/align-macro-events";
import { macroEventMarkerLabel } from "../dashboard/EconomicCalendarPanel";
import { buildEntryGuide } from "../../lib/entry-guide";
import { upcomingHighImpactEvents } from "../../lib/align-macro-events";
import {
  applyZoomFactor,
  dragZoomFactor,
  panYDomain,
  wheelZoomFactor,
  zoomYDomain,
  type YDomain,
} from "../../lib/chart-y-zoom";
import type { StochSeriesPoint } from "../../types/market";
import type { MacroEvent } from "../../types/macro-events";
import type {
  EntryZone,
  ExitStrategy,
  ForecastPoint,
  ScenarioHorizonId,
  ScenarioIndicators,
  TradeSide,
} from "../../types/scenario";

interface PricePoint {
  ts: string;
  isoTs?: string;
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
  passed: "bg-surface-elevated text-content-primary",
  neutral: "bg-surface-elevated text-content-secondary",
  watch: "bg-surface-elevated text-content-secondary",
  near_tp: "bg-accent-green/20 text-accent-green",
  near_sl: "bg-accent-red/20 text-accent-red",
  trend_reversal: "bg-accent-amber/25 text-amber-100",
};

const CHART_POINT_WIDTH = 44;
const PRICE_CHART_HEIGHT = 280;
const Y_SCALE_WIDTH = 44;
const CHART_LABEL_MARGIN = 72;
const CHART_LEFT = 56;

const ENTRY_ZONE_FILL = "#38bdf8";
const ENTRY_ZONE_STROKE = "#bae6fd";

interface ChartRow {
  ts: string;
  isoTs?: string;
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
  horizonId?: ScenarioHorizonId;
  periodHint?: string;
  indicators?: ScenarioIndicators;
  branchLabel?: string;
  stochSeries?: StochSeriesPoint[];
  macroEvents?: MacroEvent[];
}

function formatOpenedAt(d: Date): string {
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPriceLabel(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toLocaleString()}`;
}

function formatPriceLineLabel(prefix: string, value: number): string {
  return `${prefix} ${formatPriceLabel(value)}`;
}

function formatFutureLabel(ts: string, horizonId: ScenarioHorizonId, index: number): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return `+${index + 1}`;

  if (horizonId === "today") return `+${index + 1}時間`;
  if (horizonId === "week") return `+${index + 1}日`;
  if (horizonId === "month") return `+${index + 1}週`;
  return date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function buildChartRows(
  history: PricePoint[],
  currentPrice: number,
  forecast: ForecastPoint[],
  horizonId: ScenarioHorizonId,
): ChartRow[] {
  const past = history.map((h) => ({
    ts: h.ts,
    isoTs: h.isoTs,
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
    ts: formatFutureLabel(f.ts, horizonId, i),
    kind: "future" as const,
    pastPrice: null,
    futurePrice: f.price,
  }));

  return [...past, nowRow, ...future];
}

function chartYDomain(
  chartData: ChartRow[],
  entryLow: number,
  entryHigh: number,
  takeProfit: number[],
  stopLoss: number,
): [number, number] {
  const prices = chartData.flatMap((row) =>
    [row.pastPrice, row.futurePrice].filter((p): p is number => p != null && p > 0),
  );
  const levels = [entryLow, entryHigh, stopLoss, ...takeProfit].filter((p) => p > 0);
  const all = [...prices, ...levels];
  if (!all.length) return [0, 1];

  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || max * 0.02;
  const pad = span * 0.08;
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const price =
    row.kind === "past"
      ? row.pastPrice
      : row.kind === "future"
        ? row.futurePrice
        : row.pastPrice ?? row.futurePrice;

  if (price == null) return null;

  const kindLabel =
    row.kind === "past" ? "過去の価格" : row.kind === "now" ? "現在の価格" : "将来の目安";

  const timeLabel = label === "いま" ? "いま（アプリを開いた時点）" : label ?? "";

  return (
    <div className="rounded-lg border border-surface-border bg-surface-hover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-content-secondary">{timeLabel}</p>
      <p className="font-english text-slate-100">
        {kindLabel}: ${price.toLocaleString()}
      </p>
    </div>
  );
}

export function ScenarioPriceChart({
  history,
  currentPrice,
  openedAt,
  forecast,
  entry,
  exit,
  horizonId = "today",
  periodHint = "7日間（4時間足）",
  indicators,
  branchLabel,
  stochSeries = [],
  macroEvents = [],
}: ScenarioPriceChartProps) {
  const entryLow = Math.min(entry.zone_low, entry.zone_high);
  const entryHigh = Math.max(entry.zone_low, entry.zone_high);
  const nextMacro = upcomingHighImpactEvents(macroEvents, 48)[0];
  const macroEventWithinHours = nextMacro
    ? (new Date(nextMacro.scheduled_at).getTime() - Date.now()) / (60 * 60 * 1000)
    : null;
  const guide = buildEntryGuide(
    currentPrice,
    entry.zone_low,
    entry.zone_high,
    entry.side,
    exit.stop_loss,
    exit.take_profit,
    {
      etfTrend: indicators?.etf_trend,
      putCallRatio: indicators?.put_call_ratio,
      onchainActivity: indicators?.onchain_activity_trend,
      taTrend: indicators?.ta_trend,
      rsi14: indicators?.rsi_14,
      fearGreed: indicators?.fear_greed,
      fundingRate: indicators?.funding_rate,
      usdtDominanceTrend: indicators?.usdt_dominance_trend,
      stochCross: indicators?.stoch_last_cross,
      stochK: indicators?.stoch_k,
      macroEventWithinHours,
    },
  );

  const chartData = buildChartRows(history, currentPrice, forecast, horizonId);
  const chartWidth = Math.max(chartData.length * CHART_POINT_WIDTH, 360);
  const stochRows = useMemo(
    () => alignStochToChartRows(chartData, stochSeries),
    [chartData, stochSeries],
  );
  const macroMarkers = useMemo(
    () => alignMacroEventsToChartRows(chartData, macroEvents),
    [chartData, macroEvents],
  );

  const baseYDomain = useMemo(
    () => chartYDomain(chartData, entryLow, entryHigh, exit.take_profit, exit.stop_loss),
    [chartData, entryLow, entryHigh, exit.take_profit, exit.stop_loss],
  );
  const baseYDomainRef = useRef(baseYDomain);
  baseYDomainRef.current = baseYDomain;

  const [yDomainOverride, setYDomainOverride] = useState<YDomain | null>(null);
  const yDomain = yDomainOverride ?? baseYDomain;

  useEffect(() => {
    setYDomainOverride(null);
  }, [baseYDomain[0], baseYDomain[1]]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pricePlotRef = useRef<HTMLDivElement>(null);
  const yDragRef = useRef<{ startY: number; startDomain: YDomain; mode: "zoom" | "pan" } | null>(
    null,
  );

  const ZOOM_STEP = 1.22;

  const zoomPrice = useCallback((factor: number) => {
    setYDomainOverride((prev) => {
      const current = prev ?? baseYDomainRef.current;
      const anchor = (current[0] + current[1]) / 2;
      return applyZoomFactor(current, factor, anchor);
    });
  }, []);

  const applyWheelZoom = useCallback(
    (deltaY: number, pinch = false) => {
      const factor = wheelZoomFactor(deltaY, { pinch });
      if (Math.abs(factor - 1) < 0.001) return;
      zoomPrice(factor);
    },
    [zoomPrice],
  );

  useEffect(() => {
    const plot = pricePlotRef.current;
    const scroll = scrollRef.current;
    if (!plot && !scroll) return;

    let lastGestureScale = 1;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        applyWheelZoom(e.deltaY, true);
        return;
      }
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        applyWheelZoom(e.deltaY);
      }
    };

    const onGestureStart = (e: Event) => {
      e.preventDefault();
      lastGestureScale = (e as unknown as { scale: number }).scale;
    };

    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as unknown as { scale: number };
      const ratio = ge.scale / lastGestureScale;
      lastGestureScale = ge.scale;
      if (Math.abs(ratio - 1) < 0.002) return;
      zoomPrice(ratio);
    };

    for (const el of [plot, scroll].filter(Boolean) as HTMLElement[]) {
      el.addEventListener("wheel", onWheel, { passive: false });
      el.addEventListener("gesturestart", onGestureStart);
      el.addEventListener("gesturechange", onGestureChange);
    }

    return () => {
      for (const el of [plot, scroll].filter(Boolean) as HTMLElement[]) {
        el.removeEventListener("wheel", onWheel);
        el.removeEventListener("gesturestart", onGestureStart);
        el.removeEventListener("gesturechange", onGestureChange);
      }
    };
  }, [applyWheelZoom, zoomPrice]);

  const onYScalePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    yDragRef.current = {
      startY: e.clientY,
      startDomain: yDomain,
      mode: e.shiftKey ? "pan" : "zoom",
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onYScalePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = yDragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (drag.mode === "pan") {
      const span = drag.startDomain[1] - drag.startDomain[0];
      const delta = (-dy / PRICE_CHART_HEIGHT) * span;
      setYDomainOverride(panYDomain(drag.startDomain, delta));
      return;
    }
    const factor = dragZoomFactor(dy, PRICE_CHART_HEIGHT);
    const anchor = (drag.startDomain[0] + drag.startDomain[1]) / 2;
    setYDomainOverride(zoomYDomain(drag.startDomain, factor, anchor));
  };

  const onYScalePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    yDragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const badgeClass = STATUS_BADGE[guide.status] ?? STATUS_BADGE.neutral;
  const isZoomed =
    yDomainOverride != null &&
    (Math.abs(yDomainOverride[0] - baseYDomain[0]) > 1 ||
      Math.abs(yDomainOverride[1] - baseYDomain[1]) > 1);

  const totalHeight = PRICE_CHART_HEIGHT + ENTRY_STOCH_HEIGHT;

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-content-secondary">エントリー判断と価格の流れ</h2>
          <p className="mt-1 text-xs text-content-muted">
            {branchLabel ? `${branchLabel} — ` : ""}
            {formatOpenedAt(openedAt)} 時点 — 左が過去、右が{periodHint}の目安
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}>
            {guide.headline}
          </span>
          <span className="text-xs text-content-muted">{SIDE_LABEL[entry.side]}</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-surface-border/60 bg-surface/50 px-4 py-3">
        <div>
          <p className="text-[10px] text-content-muted">いまの価格</p>
          <p className="font-english text-xl font-semibold text-white">
            ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="text-sm text-content-secondary">
          <p>{guide.detail}</p>
          <p className="mt-1 text-xs text-content-muted">{guide.action}</p>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-content-muted">
          横スクロール＝時間軸。価格エリア上で縦スワイプ／ピンチで価格幅調整（トラックパッド対応）
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="価格幅を拡大"
            onClick={() => zoomPrice(ZOOM_STEP)}
            className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md border border-surface-border text-sm text-content-secondary hover:bg-surface-hover"
          >
            ＋
          </button>
          <button
            type="button"
            aria-label="価格幅を縮小"
            onClick={() => zoomPrice(1 / ZOOM_STEP)}
            className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md border border-surface-border text-sm text-content-secondary hover:bg-surface-hover"
          >
            －
          </button>
          {isZoomed ? (
            <button
              type="button"
              onClick={() => setYDomainOverride(null)}
              className="min-h-[32px] rounded-md border border-surface-border px-2.5 py-1 text-[10px] text-content-secondary transition hover:bg-surface-hover"
            >
              価格幅リセット
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-lg border border-surface-border/40 bg-surface/30"
      >
        <div style={{ width: chartWidth + Y_SCALE_WIDTH, minHeight: totalHeight }}>
          <div className="flex">
            <div
              ref={pricePlotRef}
              style={{ width: chartWidth, height: PRICE_CHART_HEIGHT }}
            >
              <ComposedChart
                key={`price-y-${yDomain[0].toFixed(0)}-${yDomain[1].toFixed(0)}`}
                width={chartWidth}
                height={PRICE_CHART_HEIGHT}
                data={chartData}
                margin={{ top: 16, right: CHART_LABEL_MARGIN, left: CHART_LEFT, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="ts" hide />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  domain={[yDomain[0], yDomain[1]]}
                  allowDataOverflow
                  type="number"
                  scale="linear"
                  width={48}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceArea
                  y1={entryLow}
                  y2={entryHigh}
                  fill={ENTRY_ZONE_FILL}
                  fillOpacity={0.42}
                  stroke={ENTRY_ZONE_STROKE}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  ifOverflow="hidden"
                  label={{
                    value: "エントリー帯",
                    fill: "#e0f2fe",
                    fontSize: 11,
                    fontWeight: 600,
                    position: "insideTopLeft",
                  }}
                />
                <ReferenceLine
                  x="いま"
                  stroke="#ffffff"
                  strokeWidth={2}
                  ifOverflow="hidden"
                  label={{ value: "いま", fill: "#e2e8f0", fontSize: 10, position: "top" }}
                />
                {macroMarkers.map((marker) => (
                  <ReferenceLine
                    key={`${marker.ts}-${marker.events[0]?.event_id}`}
                    x={marker.ts}
                    stroke={marker.impact === "high" ? "#f87171" : "#fbbf24"}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    ifOverflow="hidden"
                    label={{
                      value: macroEventMarkerLabel(marker.events),
                      fill: marker.impact === "high" ? "#fca5a5" : "#fde68a",
                      fontSize: 9,
                      fontWeight: 600,
                      position: "top",
                    }}
                  />
                ))}
                {exit.take_profit.map((tp, i) => (
                  <ReferenceLine
                    key={`tp-${i}-${tp}`}
                    y={tp}
                    stroke="#22c55e"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    ifOverflow="hidden"
                    label={{
                      value: formatPriceLineLabel(`TP${i + 1}`, tp),
                      fill: "#86efac",
                      fontSize: 10,
                      position: "right",
                    }}
                  />
                ))}
                <ReferenceLine
                  y={exit.stop_loss}
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  ifOverflow="hidden"
                  label={{
                    value: formatPriceLineLabel("SL", exit.stop_loss),
                    fill: "#fca5a5",
                    fontSize: 10,
                    position: "right",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pastPrice"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: "#60a5fa" }}
                  connectNulls={false}
                  name="pastPrice"
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
                  name="futurePrice"
                />
              </ComposedChart>
            </div>
            <div
              role="slider"
              aria-label="価格軸の拡大縮小"
              className="flex shrink-0 cursor-ns-resize select-none flex-col items-center justify-center border-l border-surface-border/50 bg-surface/60 text-[9px] leading-tight text-content-muted"
              style={{ width: Y_SCALE_WIDTH, height: PRICE_CHART_HEIGHT }}
              onPointerDown={onYScalePointerDown}
              onPointerMove={onYScalePointerMove}
              onPointerUp={onYScalePointerUp}
              onPointerCancel={onYScalePointerUp}
              title="ドラッグで価格幅を調整（Shift+ドラッグで移動）"
            >
              <span className="font-japanese text-[9px]" style={{ writingMode: "vertical-rl" }}>
                価格幅
              </span>
              <span className="mt-1">↕</span>
            </div>
          </div>

          <div className="relative flex">
            <EntryStochasticPane data={stochRows} width={chartWidth} showXAxis />
            <div
              className="shrink-0 border-l border-surface-border/50 bg-surface/40"
              style={{ width: Y_SCALE_WIDTH, height: ENTRY_STOCH_HEIGHT }}
              aria-hidden
            />
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-surface-border/60 pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-content-muted">エントリー帯</dt>
          <dd className="font-english text-slate-200">
            ${entryLow.toLocaleString()} – ${entryHigh.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-content-muted">利確（TP）</dt>
          <dd className="font-english text-accent-green">
            {exit.take_profit.length
              ? exit.take_profit.map((p) => `$${p.toLocaleString()}`).join(" / ")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-content-muted">損切り（SL）</dt>
          <dd className="font-english text-accent-red">${exit.stop_loss.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs text-content-muted">ストキャス</dt>
          <dd className="font-english text-slate-300">
            {indicators?.stoch_k != null && indicators?.stoch_d != null
              ? `%K ${indicators.stoch_k.toFixed(0)} / %D ${indicators.stoch_d.toFixed(0)}${
                  indicators.stoch_last_cross
                    ? ` · 直近${indicators.stoch_last_cross === "gc" ? "GC" : "DC"}`
                    : ""
                }`
              : "—"}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-content-muted">
        上段＝価格（水色帯＝エントリー候補）　下段＝同じ4時間足のストキャス（GC/DCは丸印）　横スクロールで時間軸が連動します
      </p>
    </section>
  );
}
