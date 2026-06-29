import { candleIntervalHours, formatEntryChartCompact, type CandleInterval } from "./candle-interval";
import type { StochSeriesPoint } from "../types/market";

export interface AlignedStochRow {
  ts: string;
  k: number | null;
  d: number | null;
  cross: "gc" | "dc" | null;
}

const FOUR_H_MS = 4 * 60 * 60 * 1000;

function findClosestStoch(
  series: StochSeriesPoint[],
  targetMs: number,
  toleranceMs: number,
): StochSeriesPoint | null {
  let best: StochSeriesPoint | null = null;
  let bestDiff = Infinity;
  for (const pt of series) {
    const ms = new Date(pt.ts).getTime();
    if (Number.isNaN(ms)) continue;
    const diff = Math.abs(ms - targetMs);
    if (diff < bestDiff && diff <= toleranceMs) {
      bestDiff = diff;
      best = pt;
    }
  }
  return best;
}

/** Align stoch series to candle timestamps (technical chart). */
export function alignStochToCandles(
  candles: { ts: string }[],
  series: StochSeriesPoint[],
  interval: CandleInterval,
): AlignedStochRow[] {
  const toleranceMs = candleIntervalHours(interval) * 60 * 60 * 1000;
  return candles.map((candle) => {
    const label = formatEntryChartCompact(candle.ts);
    const targetMs = new Date(candle.ts).getTime();
    if (Number.isNaN(targetMs)) {
      return { ts: label, k: null, d: null, cross: null };
    }
    const pt = findClosestStoch(series, targetMs, toleranceMs);
    if (!pt) {
      return { ts: label, k: null, d: null, cross: null };
    }
    return {
      ts: label,
      k: pt.k,
      d: pt.d,
      cross: pt.cross,
    };
  });
}

/** Align stoch series to entry chart rows (same `ts` labels). */
export function alignStochToChartRows(
  rows: { ts: string; isoTs?: string; kind: "past" | "now" | "future" }[],
  series: StochSeriesPoint[],
): AlignedStochRow[] {
  return rows.map((row) => {
    if (row.kind !== "past" || !row.isoTs) {
      return { ts: row.ts, k: null, d: null, cross: null };
    }
    const targetMs = new Date(row.isoTs).getTime();
    if (Number.isNaN(targetMs)) {
      return { ts: row.ts, k: null, d: null, cross: null };
    }
    const pt = findClosestStoch(series, targetMs, FOUR_H_MS);
    if (!pt) {
      return { ts: row.ts, k: null, d: null, cross: null };
    }
    return {
      ts: row.ts,
      k: pt.k,
      d: pt.d,
      cross: pt.cross,
    };
  });
}
