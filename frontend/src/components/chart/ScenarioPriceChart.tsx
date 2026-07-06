import { useMemo } from "react";
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
import { ChartViewportFrame } from "./ChartViewportFrame";
import { EntryStochasticPane, ENTRY_STOCH_HEIGHT } from "./EntryStochasticPane";
import { alignStochToChartRows } from "../../lib/align-stoch-history";
import { mergeMacroEventMarkers, upcomingHighImpactEvents } from "../../lib/align-macro-events";
import { macroEventMarkerLabel } from "../dashboard/EconomicCalendarPanel";
import { buildEntryGuide } from "../../lib/entry-guide";
import { presentEntryGuide } from "../../lib/scenario-presentation";
import type { PrimaryRecommendation } from "../../lib/scenario-branches";
import { findMtfGate } from "../../lib/mtf-entry-gate";
import type { StochSeriesPoint } from "../../types/market";
import type { MacroEvent } from "../../types/macro-events";
import type {
  EntryZone,
  ExitStrategy,
  ForecastPoint,
  HoldScenarioContext,
  HorizonMode,
  MtfEntryGate,
  ScenarioHorizonId,
  ScenarioIndicators,
  TradeSide,
} from "../../types/scenario";
import { isHodlHorizon } from "../../lib/scenario-horizons";
import { EXTERNAL_LINKS } from "../../lib/external-links";
import type { DataRefreshProps } from "../../types/data-refresh";
import { DataPanelMeta } from "../ui/DataPanelMeta";

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

const BASE_POINT_WIDTH = 44;
const PRICE_CHART_HEIGHT = 280;
const CHART_LABEL_MARGIN = 72;
const CHART_LEFT = 56;

const ENTRY_ZONE_FILL = "#38bdf8";
const ENTRY_ZONE_STROKE = "#bae6fd";

interface ChartRow {
  ts: string;
  isoTs?: string;
  kind: "past" | "now" | "future" | "macro";
  pastPrice: number | null;
  futurePrice: number | null;
}

interface ScenarioPriceChartProps extends DataRefreshProps {
  history: PricePoint[];
  currentPrice: number;
  openedAt: Date;
  forecast: ForecastPoint[];
  entry: EntryZone;
  exit: ExitStrategy;
  horizonId?: ScenarioHorizonId;
  horizonMode?: HorizonMode;
  holdContext?: HoldScenarioContext | null;
  periodHint?: string;
  indicators?: ScenarioIndicators;
  branchLabel?: string;
  primaryRecommendation?: PrimaryRecommendation;
  stochSeries?: StochSeriesPoint[];
  macroEvents?: MacroEvent[];
  mtfGates?: MtfEntryGate[];
  chartUpdatedAt?: string | null;
  scenarioGeneratedAt?: string | null;
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
  if (horizonId === "hodl") {
    return date.toLocaleDateString("ja-JP", { year: "numeric", month: "short" });
  }
  return date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function buildChartRows(
  history: PricePoint[],
  currentPrice: number,
  forecast: ForecastPoint[],
  horizonId: ScenarioHorizonId,
  nowIso: string,
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
    isoTs: nowIso,
    kind: "now",
    pastPrice: currentPrice,
    futurePrice: currentPrice,
  };

  const future = forecast.map((f, i) => ({
    ts: formatFutureLabel(f.ts, horizonId, i),
    isoTs: f.ts,
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
  payload?: Array<{ payload: ChartRow; value: number; name?: string; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const pastEntry = payload.find((p) => p.name === "pastPrice" || p.dataKey === "pastPrice");
  const futureEntry = payload.find((p) => p.name === "futurePrice" || p.dataKey === "futurePrice");

  let price: number | null = null;
  let kindLabel: string;

  if (pastEntry?.value != null && !Number.isNaN(Number(pastEntry.value))) {
    price = Number(pastEntry.value);
    kindLabel = row.kind === "now" ? "現在の価格" : "過去の価格";
  } else if (futureEntry?.value != null && !Number.isNaN(Number(futureEntry.value))) {
    price = Number(futureEntry.value);
    kindLabel = row.kind === "now" ? "現在の価格" : "将来の目安";
  } else if (row.kind === "past" || (row.kind === "macro" && row.pastPrice != null)) {
    price = row.pastPrice ?? null;
    kindLabel = "過去の価格";
  } else if (row.kind === "now") {
    price = row.pastPrice ?? row.futurePrice;
    kindLabel = "現在の価格";
  } else {
    price = row.futurePrice ?? row.pastPrice ?? null;
    kindLabel = "将来の目安";
  }

  if (price == null) return null;

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
  horizonMode = "swing",
  holdContext = null,
  periodHint = "7日間（4時間足）",
  indicators,
  branchLabel,
  primaryRecommendation = "bullish",
  stochSeries = [],
  macroEvents = [],
  mtfGates = [],
  chartUpdatedAt,
  scenarioGeneratedAt,
  onRefresh,
  refreshing,
}: ScenarioPriceChartProps) {
  const isHodl = isHodlHorizon(horizonId, horizonMode);
  const entryLow = Math.min(entry.zone_low, entry.zone_high);
  const entryHigh = Math.max(entry.zone_low, entry.zone_high);
  const nextMacro = upcomingHighImpactEvents(macroEvents, 48)[0];
  const macroEventWithinHours = nextMacro
    ? (new Date(nextMacro.scheduled_at).getTime() - Date.now()) / (60 * 60 * 1000)
    : null;
  const mtfGate = findMtfGate(mtfGates, entry.side);
  const swingGuide = buildEntryGuide(
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
      ichimokuSignal: indicators?.ichimoku_signal,
      longShortSignal: indicators?.long_short_signal,
      macroEventWithinHours,
      mtfEntryBlocked: mtfGate?.entry_blocked ?? indicators?.mtf_entry_blocked,
      mtfEntryTimingReady: mtfGate?.entry_timing_ready ?? indicators?.mtf_entry_timing_ready,
      mtfNearHtfBarrier: mtfGate?.near_htf_barrier ?? indicators?.mtf_near_htf_barrier,
      mtfGateSummary: mtfGate?.gate_summary_ja ?? indicators?.mtf_summary_ja,
      mtfCaution: mtfGate?.caution_ja,
    },
  );
  const guide = isHodl
    ? {
        status: "in_zone" as const,
        headline: "ガチホ・積み増し視点",
        detail: holdContext?.cycle_phase_ja ?? "半減期サイクル上の参考局面です。",
        action:
          "損切りは設定しません。積み増し帯と長期参考上値を確認し、余裕資金で分割購入を検討してください。",
        distanceUsd: null,
        distancePct: null,
        direction: null,
      }
    : swingGuide;

  const presentation = isHodl
    ? {
        headline: guide.headline,
        badgeClass: "bg-violet-500/20 text-violet-200",
        showCautionStrip: false,
      }
    : presentEntryGuide(guide, primaryRecommendation);

  const { chartData, macroMarkers } = useMemo(() => {
    const baseRows = buildChartRows(
      history,
      currentPrice,
      forecast,
      horizonId,
      openedAt.toISOString(),
    );
    const merged = mergeMacroEventMarkers(baseRows, macroEvents, openedAt.getTime());
    return { chartData: merged.rows, macroMarkers: merged.markers };
  }, [history, currentPrice, forecast, horizonId, openedAt, macroEvents]);

  const stochRows = useMemo(
    () => alignStochToChartRows(chartData, stochSeries),
    [chartData, stochSeries],
  );

  const peakLevels = useMemo(
    () =>
      isHodl && holdContext
        ? holdContext.peak_targets.flatMap((p) => [p.price_low, p.price_high])
        : [],
    [isHodl, holdContext],
  );
  const buyZoneLevels = useMemo(
    () =>
      isHodl && holdContext
        ? holdContext.buy_zones.flatMap((z) => [z.zone_low, z.zone_high])
        : [],
    [isHodl, holdContext],
  );

  const baseYDomain = useMemo(() => {
    const sl = isHodl ? 0 : exit.stop_loss;
    const tps = isHodl ? peakLevels : exit.take_profit;
    const domain = chartYDomain(chartData, entryLow, entryHigh, tps, sl);
    if (!buyZoneLevels.length) return domain;
    const all = [...buyZoneLevels, ...peakLevels, currentPrice, domain[0], domain[1]];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.06 || currentPrice * 0.02;
    return [Math.floor(min - pad), Math.ceil(max + pad)] as [number, number];
  }, [
    chartData,
    entryLow,
    entryHigh,
    exit.take_profit,
    exit.stop_loss,
    isHodl,
    peakLevels,
    buyZoneLevels,
    currentPrice,
  ]);

  const badgeClass = presentation.badgeClass;

  const renderPriceChart = (contentWidth: number, yDomain: [number, number]) => (
    <ComposedChart
      width={contentWidth}
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
          value: isHodl ? "積み増し帯" : "エントリー帯",
          fill: "#e0f2fe",
          fontSize: 11,
          fontWeight: 600,
          position: "insideTopLeft",
        }}
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
            value: formatPriceLineLabel(isHodl ? `参考上値${i + 1}` : `TP${i + 1}`, tp),
            fill: "#86efac",
            fontSize: 10,
            position: "right",
          }}
        />
      ))}
      {!isHodl && exit.stop_loss > 0 ? (
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
      ) : null}
      {isHodl && holdContext
        ? holdContext.buy_zones.slice(1).map((zone) => (
            <ReferenceArea
              key={zone.label}
              y1={zone.zone_low}
              y2={zone.zone_high}
              fill="#38bdf8"
              fillOpacity={0.15}
              stroke="#7dd3fc"
              strokeWidth={1}
              strokeDasharray="3 3"
              ifOverflow="hidden"
            />
          ))
        : null}
      <ReferenceLine
        x="いま"
        stroke="#ffffff"
        strokeWidth={2}
        ifOverflow="hidden"
        label={{ value: "いま", fill: "#e2e8f0", fontSize: 10, position: "top" }}
      />
      <Line
        type="monotone"
        dataKey="pastPrice"
        stroke="#60a5fa"
        strokeWidth={2}
        dot={{ r: 2.5, fill: "#60a5fa" }}
        connectNulls={false}
        isAnimationActive={false}
        name="pastPrice"
      />
      <Line
        type="monotone"
        dataKey="futurePrice"
        stroke="#a78bfa"
        strokeWidth={2}
        strokeDasharray="6 4"
        isAnimationActive={false}
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
  );

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <DataPanelMeta
        title="エントリー判断と価格の流れ"
        subtitle={`${branchLabel ? `${branchLabel} — ` : ""}${formatOpenedAt(openedAt)} 時点 — 左が過去、右が${periodHint}の目安`}
        sourceHref={EXTERNAL_LINKS.binanceSpot}
        sourceLabel="Binance"
        updatedAt={chartUpdatedAt ?? scenarioGeneratedAt}
        onRefresh={onRefresh}
        refreshing={refreshing}
        refreshLabel="エントリーチャートを更新"
        headerActions={
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded-lg px-3 py-1.5 font-japanese text-xs font-medium ${badgeClass}`}>
              {presentation.headline}
            </span>
            <span className="font-japanese text-xs text-content-muted">{SIDE_LABEL[entry.side]}</span>
          </div>
        }
        className="mb-4"
      />

      <div className="mb-4 space-y-3">
        {presentation.showCautionStrip && presentation.subheadline ? (
          <div
            className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2"
            role="status"
          >
            <p className="font-japanese text-xs font-medium text-amber-100">{presentation.subheadline}</p>
            <p className="mt-1 font-japanese text-xs text-amber-100/80">{guide.action}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-surface-border/60 bg-surface/50 px-4 py-3">
          <div>
            <p className="font-japanese text-[10px] text-content-muted">いまの価格</p>
            <p className="font-english text-xl font-semibold text-white">
              ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="font-japanese text-sm text-content-secondary">
            <p>{guide.detail}</p>
            {!presentation.showCautionStrip ? (
              <p className="mt-1 text-xs text-content-muted">{guide.action}</p>
            ) : null}
          </div>
        </div>
      </div>

      <ChartViewportFrame
        pointCount={chartData.length}
        basePointWidth={BASE_POINT_WIDTH}
        baseYDomain={baseYDomain}
        plotHeight={PRICE_CHART_HEIGHT}
        plotLeftMargin={CHART_LEFT}
        bottomHeight={isHodl ? 44 : ENTRY_STOCH_HEIGHT}
        bottom={
          !isHodl
            ? (w) => <EntryStochasticPane data={stochRows} width={w} showXAxis />
            : () => (
                <div className="px-4 py-3 font-japanese text-[10px] text-content-muted">
                  ガチホ表示ではストキャスは省略（スイングは「本日」「今週」タブを参照）
                </div>
              )
        }
      >
        {({ contentWidth, yDomain }) => renderPriceChart(contentWidth, yDomain)}
      </ChartViewportFrame>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-surface-border/60 pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-content-muted">{isHodl ? "積み増し帯" : "エントリー帯"}</dt>
          <dd className="font-english text-slate-200">
            ${entryLow.toLocaleString()} – ${entryHigh.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-content-muted">{isHodl ? "参考上値" : "利確（TP）"}</dt>
          <dd className="font-english text-accent-green">
            {exit.take_profit.length
              ? exit.take_profit.map((p) => `$${p.toLocaleString()}`).join(" / ")
              : "—"}
          </dd>
        </div>
        {!isHodl ? (
          <div>
            <dt className="text-xs text-content-muted">損切り（SL）</dt>
            <dd className="font-english text-accent-red">${exit.stop_loss.toLocaleString()}</dd>
          </div>
        ) : (
          <div>
            <dt className="text-xs text-content-muted">損切り</dt>
            <dd className="font-japanese text-content-muted">設定なし（ガチホ）</dd>
          </div>
        )}
        {!isHodl ? (
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
        ) : (
          <div>
            <dt className="text-xs text-content-muted">次の半減期</dt>
            <dd className="font-japanese text-slate-300">
              {holdContext?.next_halving_label ?? "—"}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-3 text-xs text-content-muted">
        {isHodl
          ? "上段＝価格の長期目安（水色帯＝積み増し候補・緑線＝サイクル参考上値）　損切りは表示しません"
          : "上段＝価格（水色帯＝エントリー候補）　下段＝ストキャス　ドラッグで移動・ホイールでズーム（TradingView風）"}
      </p>
    </section>
  );
}
