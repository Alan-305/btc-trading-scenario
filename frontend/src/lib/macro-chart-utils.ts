export interface MacroSeriesPoint {
  ts: string;
  value: number;
}

export function formatChartDate(iso: string, short = true): string {
  const d = new Date(iso);
  if (short) {
    return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
  }
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

export function formatCompactUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatCompactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export const MACRO_CHART = {
  grid: "#2a2a2a",
  axis: "#9a9aa4",
  tooltipBg: "#141414",
  tooltipBorder: "#2a2a2a",
  green: "#10b981",
  red: "#ef4444",
  blue: "#3b82f6",
  amber: "#f59e0b",
  purple: "#a78bfa",
} as const;
