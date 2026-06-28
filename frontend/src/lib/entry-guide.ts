import type { TradeSide } from "../types/scenario";

export type EntryStatus =
  | "in_zone"
  | "wait_pullback"
  | "wait_rally"
  | "passed"
  | "neutral";

export interface EntryGuide {
  status: EntryStatus;
  headline: string;
  detail: string;
  action: string;
  distanceUsd: number | null;
  distancePct: number | null;
  direction: "up" | "down" | null;
}

export interface MacroHints {
  etfTrend?: string | null;
  putCallRatio?: number | null;
  onchainActivity?: string | null;
}

export function buildEntryGuide(
  currentPrice: number,
  entryLow: number,
  entryHigh: number,
  side: TradeSide,
  _stopLoss: number,
  _takeProfit: number[],
  macro?: MacroHints,
): EntryGuide {
  const low = Math.min(entryLow, entryHigh);
  const high = Math.max(entryLow, entryHigh);

  const macroNote = formatMacroNote(macro);

  if (side === "neutral" || currentPrice <= 0) {
    return {
      status: "neutral",
      headline: "いまは様子見",
      detail: "明確なエントリー方向がありません。",
      action: `4時間足とエントリー帯が近づくまで待ちましょう。${macroNote}`,
      distanceUsd: null,
      distancePct: null,
      direction: null,
    };
  }

  const inZone = currentPrice >= low && currentPrice <= high;

  if (inZone) {
    return {
      status: "in_zone",
      headline: "いまがエントリー候補の価格帯です",
      detail: `$${low.toLocaleString()} 〜 $${high.toLocaleString()} の範囲に入っています。`,
      action:
        (side === "long"
          ? "ロングを検討するなら、この帯でエントリー。SL・TPは下の目安を参照してください。"
          : "ショートを検討するなら、この帯でエントリー。SL・TPは下の目安を参照してください。") + macroNote,
      distanceUsd: 0,
      distancePct: 0,
      direction: null,
    };
  }

  if (side === "long") {
    if (currentPrice > high) {
      const dist = currentPrice - high;
      const pct = (dist / currentPrice) * 100;
      return {
        status: "wait_pullback",
        headline: "あと少し下がればエントリー帯",
        detail: `現在はエントリー帯より上です。$${high.toLocaleString()} まであと $${Math.round(dist).toLocaleString()}（${pct.toFixed(2)}%）下がると帯に到達します。`,
        action: "価格が青いエントリー帯に入るのを待ってから判断しましょう。",
        distanceUsd: dist,
        distancePct: pct,
        direction: "down",
      };
    }
    const dist = low - currentPrice;
    const pct = (dist / currentPrice) * 100;
    return {
      status: "passed",
      headline: "エントリー帯を下抜けています",
      detail: `帯（$${low.toLocaleString()}〜）より下にいます。シナリオが古い可能性があります。`,
      action: "「再分析」で最新のエントリー帯を確認してください。",
      distanceUsd: dist,
      distancePct: pct,
      direction: "up",
    };
  }

  // short
  if (currentPrice < low) {
    const dist = low - currentPrice;
    const pct = (dist / currentPrice) * 100;
    return {
      status: "wait_rally",
      headline: "あと少し上がればエントリー帯",
      detail: `現在はエントリー帯より下です。$${low.toLocaleString()} まであと $${Math.round(dist).toLocaleString()}（${pct.toFixed(2)}%）上がると帯に到達します。`,
      action: "価格が青いエントリー帯に入るのを待ってから判断しましょう。",
      distanceUsd: dist,
      distancePct: pct,
      direction: "up",
    };
  }
  const dist = currentPrice - high;
  const pct = (dist / currentPrice) * 100;
  return {
    status: "passed",
    headline: "エントリー帯を上抜けています",
    detail: `帯（〜$${high.toLocaleString()}）より上にいます。シナリオが古い可能性があります。`,
    action: "「再分析」で最新のエントリー帯を確認してください。",
    distanceUsd: dist,
    distancePct: pct,
    direction: "down",
  };
}

export function roadmapBounds(
  currentPrice: number,
  entryLow: number,
  entryHigh: number,
  stopLoss: number,
  takeProfit: number[],
): { min: number; max: number } {
  const prices = [currentPrice, entryLow, entryHigh, stopLoss, ...takeProfit];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.08 || currentPrice * 0.02;
  return { min: min - pad, max: max + pad };
}

function formatMacroNote(macro?: MacroHints): string {
  if (!macro) return "";
  const parts: string[] = [];
  if (macro.etfTrend === "inflow") parts.push("ETFは流入傾向");
  if (macro.etfTrend === "outflow") parts.push("ETFは流出傾向");
  if (macro.putCallRatio != null && macro.putCallRatio >= 1.15) {
    parts.push("Put/Call比はやや高め");
  } else if (macro.putCallRatio != null && macro.putCallRatio <= 0.75) {
    parts.push("Put/Call比はやや低め");
  }
  if (macro.onchainActivity === "rising") parts.push("オンチェーン活動は活発");
  if (macro.onchainActivity === "falling") parts.push("オンチェーン活動は減速");
  if (!parts.length) return "";
  return `（${parts.join("・")}）`;
}
