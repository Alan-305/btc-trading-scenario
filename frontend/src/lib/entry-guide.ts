import type { MacroTrend, TradeSide } from "../types/scenario";

export type EntryStatus =
  | "in_zone"
  | "wait_pullback"
  | "wait_rally"
  | "passed"
  | "neutral"
  | "near_tp"
  | "near_sl"
  | "watch"
  | "trend_reversal";

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
  taTrend?: MacroTrend | null;
  rsi14?: number | null;
  fearGreed?: number | null;
  fundingRate?: number | null;
}

const NEAR_TP_PCT = 1.5;
const NEAR_SL_PCT = 1.2;
const TREND_REVERSAL_PRICE_PCT = 3;
const WATCH_ZONE_DISTANCE_PCT = 2.5;

export function buildEntryGuide(
  currentPrice: number,
  entryLow: number,
  entryHigh: number,
  side: TradeSide,
  stopLoss: number,
  takeProfit: number[],
  macro?: MacroHints,
): EntryGuide {
  const low = Math.min(entryLow, entryHigh);
  const high = Math.max(entryLow, entryHigh);
  const entryMid = (low + high) / 2;
  const macroNote = formatMacroNote(macro);

  if (side === "neutral" || currentPrice <= 0) {
    return {
      status: "watch",
      headline: "今は様子見してください",
      detail: "明確なエントリー方向がありません。",
      action: `4時間足とエントリー帯が近づくまで待ちましょう。${macroNote}`,
      distanceUsd: null,
      distancePct: null,
      direction: null,
    };
  }

  const reversalSignals = collectReversalSignals(side, currentPrice, entryMid, macro);
  if (reversalSignals.length >= 2) {
    return {
      status: "trend_reversal",
      headline: "トレンド転換の兆し⚠️",
      detail: reversalSignals.join("。") + "。",
      action:
        "新規エントリーは控え、保有中なら利確・損切りの再確認を。状況が落ち着くまで様子見も選択肢です。" +
        macroNote,
      distanceUsd: null,
      distancePct: null,
      direction: side === "long" ? "down" : "up",
    };
  }

  const slProximity = slDistance(side, currentPrice, stopLoss);
  if (slProximity && slProximity.pct <= NEAR_SL_PCT) {
    return {
      status: "near_sl",
      headline: "損切りラインに接近⚠️",
      detail: `SL（$${stopLoss.toLocaleString()}）まであと $${Math.round(slProximity.dist).toLocaleString()}（${slProximity.pct.toFixed(2)}%）。`,
      action: "想定外の動きです。ルール通りの損切り、またはポジションサイズの見直しを検討してください。",
      distanceUsd: slProximity.dist,
      distancePct: slProximity.pct,
      direction: side === "long" ? "down" : "up",
    };
  }

  const tpProximity = tpDistance(side, currentPrice, takeProfit);
  if (
    tpProximity &&
    tpProximity.pct <= NEAR_TP_PCT &&
    hasFavorableProgress(side, currentPrice, low, high)
  ) {
    return {
      status: "near_tp",
      headline: "もう少しで利確ポイント",
      detail: `TP（$${tpProximity.tp.toLocaleString()}）まであと $${Math.round(tpProximity.dist).toLocaleString()}（${tpProximity.pct.toFixed(2)}%）。`,
      action:
        "利確の一部または全部を検討するタイミングです。トレーリングや部分利確でリスクを下げるのも有効です。" +
        macroNote,
      distanceUsd: tpProximity.dist,
      distancePct: tpProximity.pct,
      direction: side === "long" ? "up" : "down",
    };
  }

  const inZone = currentPrice >= low && currentPrice <= high;
  const zoneDistance = distanceToZone(side, currentPrice, low, high);

  if (
    !inZone &&
    zoneDistance.pct != null &&
    zoneDistance.pct > WATCH_ZONE_DISTANCE_PCT &&
    (reversalSignals.length >= 1 || macro?.taTrend === "range")
  ) {
    return {
      status: "watch",
      headline: "今は様子見してください",
      detail: `エントリー帯から離れており（約${zoneDistance.pct.toFixed(1)}%）、材料が混在しています。`,
      action:
        "無理にエントリーせず、帯への接近とシグナルの一致を待ちましょう。" +
        (reversalSignals[0] ? `（${reversalSignals[0]}）` : "") +
        macroNote,
      distanceUsd: zoneDistance.usd,
      distancePct: zoneDistance.pct,
      direction: zoneDistance.direction,
    };
  }

  if (inZone) {
    if (reversalSignals.length === 1) {
      return {
        status: "watch",
        headline: "今は様子見してください",
        detail: `エントリー帯内ですが、${reversalSignals[0]}。`,
        action:
          "帯内でも材料がぶつかっています。エントリーするならサイズを抑え、SL・TPを厳守してください。" +
          macroNote,
        distanceUsd: 0,
        distancePct: 0,
        direction: null,
      };
    }
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

function collectReversalSignals(
  side: TradeSide,
  price: number,
  entryMid: number,
  macro?: MacroHints,
): string[] {
  const signals: string[] = [];
  if (side === "long") {
    if (macro?.taTrend === "bearish") signals.push("短期テクニカルが下降気味");
    if (macro?.rsi14 != null && macro.rsi14 >= 70) signals.push("RSIが買われすぎ圏");
    if (macro?.fearGreed != null && macro.fearGreed >= 75) signals.push("F&Gが強い強欲");
    if (macro?.etfTrend === "outflow") signals.push("ETFは流出傾向");
    if (macro?.putCallRatio != null && macro.putCallRatio >= 1.2) {
      signals.push("Put/Call比が高め（警戒感）");
    }
    if (entryMid > 0 && price < entryMid * (1 - TREND_REVERSAL_PRICE_PCT / 100)) {
      signals.push(`想定から${TREND_REVERSAL_PRICE_PCT}%以上下落`);
    }
  } else if (side === "short") {
    if (macro?.taTrend === "bullish") signals.push("短期テクニカルが上昇気味");
    if (macro?.rsi14 != null && macro.rsi14 <= 30) signals.push("RSIが売られすぎ圏");
    if (macro?.fearGreed != null && macro.fearGreed <= 25) signals.push("F&Gが強い恐怖");
    if (macro?.etfTrend === "inflow") signals.push("ETFは流入傾向");
    if (macro?.putCallRatio != null && macro.putCallRatio <= 0.7) {
      signals.push("Put/Call比が低め（強気）");
    }
    if (entryMid > 0 && price > entryMid * (1 + TREND_REVERSAL_PRICE_PCT / 100)) {
      signals.push(`想定から${TREND_REVERSAL_PRICE_PCT}%以上上昇`);
    }
  }
  return signals;
}

function hasFavorableProgress(
  side: TradeSide,
  price: number,
  low: number,
  high: number,
): boolean {
  if (side === "long") return price >= low;
  if (side === "short") return price <= high;
  return false;
}

function tpDistance(
  side: TradeSide,
  price: number,
  takeProfit: number[],
): { tp: number; dist: number; pct: number } | null {
  const tps = takeProfit.filter((tp) => tp > 0);
  if (!tps.length || price <= 0) return null;

  if (side === "long") {
    const above = tps.filter((tp) => tp > price).sort((a, b) => a - b);
    if (!above.length) return null;
    const tp = above[0];
    const dist = tp - price;
    return { tp, dist, pct: (dist / price) * 100 };
  }
  if (side === "short") {
    const below = tps.filter((tp) => tp < price).sort((a, b) => b - a);
    if (!below.length) return null;
    const tp = below[0];
    const dist = price - tp;
    return { tp, dist, pct: (dist / price) * 100 };
  }
  return null;
}

function slDistance(
  side: TradeSide,
  price: number,
  stopLoss: number,
): { dist: number; pct: number } | null {
  if (stopLoss <= 0 || price <= 0) return null;

  if (side === "long") {
    if (price <= stopLoss) return null;
    const dist = price - stopLoss;
    return { dist, pct: (dist / price) * 100 };
  }
  if (side === "short") {
    if (price >= stopLoss) return null;
    const dist = stopLoss - price;
    return { dist, pct: (dist / price) * 100 };
  }
  return null;
}

function distanceToZone(
  side: TradeSide,
  price: number,
  low: number,
  high: number,
): { usd: number | null; pct: number | null; direction: "up" | "down" | null } {
  if (price > high) {
    const usd = price - high;
    return { usd, pct: (usd / price) * 100, direction: "down" };
  }
  if (price < low) {
    const usd = low - price;
    return { usd, pct: (usd / price) * 100, direction: "up" };
  }
  return { usd: 0, pct: 0, direction: side === "long" ? "down" : "up" };
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
