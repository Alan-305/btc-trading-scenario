import { useMemo } from "react";
import type { Candle, OverlayPoint, StochSeriesPoint } from "../../types/market";
import type { CandleInterval } from "../../lib/candle-interval";
import type { YDomain } from "../../lib/chart-viewport";
import { alignStochToCandles } from "../../lib/align-stoch-history";
import { CandlestickChart } from "./CandlestickChart";
import { ChartViewportFrame } from "./ChartViewportFrame";
import { EntryStochasticPane, ENTRY_STOCH_HEIGHT } from "./EntryStochasticPane";

const BASE_POINT_WIDTH = 44;
const PRICE_PLOT_HEIGHT = 342; // price + volume area (matches CandlestickChart H)

interface TechnicalLinkedChartProps {
  candles: Candle[];
  interval: CandleInterval;
  overlays?: OverlayPoint[];
  stochSeries?: StochSeriesPoint[];
  support?: number | null;
  resistance?: number | null;
  longLiqLow?: number | null;
  longLiqHigh?: number | null;
  shortSqLow?: number | null;
  shortSqHigh?: number | null;
}

function computeBaseYDomain(
  candles: Candle[],
  overlays: OverlayPoint[],
  zones: { low: number | null; high: number | null }[],
): YDomain {
  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const overlayPrices: number[] = [];
  overlays.forEach((o) => {
    if (o.ema_200 != null) overlayPrices.push(o.ema_200);
    if (o.bb_upper != null) overlayPrices.push(o.bb_upper);
    if (o.bb_lower != null) overlayPrices.push(o.bb_lower);
  });
  const zoneLows = zones.map((z) => z.low).filter((v): v is number => v != null);
  const zoneHighs = zones.map((z) => z.high).filter((v): v is number => v != null);
  if (!lows.length) return [0, 1];
  const minP = Math.min(...lows, ...zoneLows, ...overlayPrices) * 0.998;
  const maxP = Math.max(...highs, ...zoneHighs, ...overlayPrices) * 1.002;
  return [minP, maxP];
}

export function TechnicalLinkedChart({
  candles,
  interval,
  overlays = [],
  stochSeries = [],
  support,
  resistance,
  longLiqLow,
  longLiqHigh,
  shortSqLow,
  shortSqHigh,
}: TechnicalLinkedChartProps) {
  const slice = useMemo(() => candles.slice(-80), [candles]);

  const stochRows = useMemo(
    () => alignStochToCandles(slice, stochSeries, interval),
    [slice, stochSeries, interval],
  );

  const baseYDomain = useMemo(
    () =>
      computeBaseYDomain(slice, overlays, [
        { low: support ?? null, high: resistance ?? null },
        { low: longLiqLow ?? null, high: longLiqHigh ?? null },
        { low: shortSqLow ?? null, high: shortSqHigh ?? null },
      ]),
    [slice, overlays, support, resistance, longLiqLow, longLiqHigh, shortSqLow, shortSqHigh],
  );

  if (!slice.length) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-content-muted">
        ローソク足データなし
      </div>
    );
  }

  return (
    <ChartViewportFrame
      pointCount={slice.length}
      basePointWidth={BASE_POINT_WIDTH}
      baseYDomain={baseYDomain}
      plotHeight={PRICE_PLOT_HEIGHT}
      plotLeftMargin={56}
      bottomHeight={ENTRY_STOCH_HEIGHT}
      bottom={(w) => <EntryStochasticPane data={stochRows} width={w} showXAxis />}
    >
      {({ contentWidth, yDomain }) => (
        <CandlestickChart
          candles={slice}
          interval={interval}
          overlays={overlays}
          support={support}
          resistance={resistance}
          longLiqLow={longLiqLow}
          longLiqHigh={longLiqHigh}
          shortSqLow={shortSqLow}
          shortSqHigh={shortSqHigh}
          contentWidth={contentWidth}
          pointWidth={contentWidth / Math.max(slice.length, 1)}
          yDomain={yDomain}
          plotLeftMargin={56}
        />
      )}
    </ChartViewportFrame>
  );
}
