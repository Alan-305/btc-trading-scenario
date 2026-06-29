import type { MtfAnalysis, MtfEntryGate, TradeSide } from "../types/scenario";

export function findMtfGate(
  gates: MtfEntryGate[] | undefined,
  side: TradeSide,
): MtfEntryGate | undefined {
  return gates?.find((gate) => gate.side === side);
}

export function trendLabelJa(trend: string): string {
  if (trend === "bullish") return "上昇";
  if (trend === "bearish") return "下降";
  return "レンジ";
}

export function trendBadgeClass(trend: string): string {
  if (trend === "bullish") return "bg-accent-green/15 text-accent-green";
  if (trend === "bearish") return "bg-accent-red/15 text-accent-red";
  return "bg-surface-elevated text-content-secondary";
}

export function hasMtfAnalysis(mtf: MtfAnalysis | null | undefined): boolean {
  return Boolean(mtf?.layers?.length);
}
