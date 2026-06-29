export type CandleInterval = "1h" | "4h" | "1d";

export const CANDLE_INTERVAL_OPTIONS: { value: CandleInterval; label: string }[] = [
  { value: "1h", label: "1時間足" },
  { value: "4h", label: "4時間足" },
  { value: "1d", label: "日足" },
];

export function candleIntervalLabel(interval: CandleInterval): string {
  return CANDLE_INTERVAL_OPTIONS.find((o) => o.value === interval)?.label ?? interval;
}

export function candleIntervalHours(interval: CandleInterval): number {
  if (interval === "1d") return 24;
  if (interval === "4h") return 4;
  return 1;
}

/** 価格チャートの過去ラベル用 */
export function pastTimeLabel(stepsAgo: number, interval: CandleInterval): string {
  if (interval === "1d") return `-${stepsAgo}日前`;
  const hours = stepsAgo * candleIntervalHours(interval);
  return `-${hours}時間前`;
}

/** エントリー判断チャート：集計ウィンドウ（7日）と揃えた4時間足 */
export const ENTRY_EVAL_DAYS = 7;
export const ENTRY_CHART_INTERVAL: CandleInterval = "4h";
export const ENTRY_CHART_BAR_COUNT =
  (ENTRY_EVAL_DAYS * 24) / candleIntervalHours(ENTRY_CHART_INTERVAL);

export function formatEntryChartLabel(isoTs: string): string {
  const date = new Date(isoTs);
  if (Number.isNaN(date.getTime())) return isoTs;
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
  });
}

export function entryChartPeriodHint(): string {
  return `${ENTRY_EVAL_DAYS}日間（4時間足）`;
}
