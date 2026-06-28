export interface FearGreedHistoryPoint {
  period: "now" | "yesterday" | "last_week" | "last_month";
  label_ja: string;
  value: number;
  classification: string;
}

/** alternative.me 風のセンチメント色 */
export function fearGreedColor(value: number): string {
  if (value <= 25) return "#d36c3a";
  if (value <= 45) return "#e8913a";
  if (value <= 55) return "#f1d25c";
  if (value <= 75) return "#9ccf6a";
  return "#7ac55d";
}

export function fearGreedLabelJa(classification: string): string {
  const map: Record<string, string> = {
    "Extreme Fear": "極度の恐怖",
    Fear: "恐怖",
    Neutral: "中立",
    Greed: "強欲",
    "Extreme Greed": "極度の強欲",
  };
  return map[classification] ?? classification;
}

export function formatFearGreedUpdated(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}
