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
