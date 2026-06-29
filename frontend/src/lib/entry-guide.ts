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
  | "trend_reversal"
  | "wait_timing";

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
  usdtDominanceTrend?: string | null;
  stochCross?: "gc" | "dc" | null;
  stochK?: number | null;
  stochZone?: string | null;
  macroEventWithinHours?: number | null;
  mtfEntryBlocked?: boolean | null;
  mtfEntryTimingReady?: boolean | null;
  mtfNearHtfBarrier?: boolean | null;
  mtfGateSummary?: string | null;
  mtfCaution?: string | null;
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

  if (macro?.macroEventWithinHours != null && macro.macroEventWithinHours <= 6) {
    const h = Math.max(0, Math.round(macro.macroEventWithinHours));
    return {
      status: "watch",
      headline: "重要指標の前後は様子見",
      detail: `高インパクトの経済指標まで約${h}時間です。ボラティリティが急拡大しやすい時間帯です。`,
      action:
        "新規エントリーは控えめに。保有中ならサイズ縮小や指標後の値動き確認を優先してください。" +
        macroNote,
      distanceUsd: null,
      distancePct: null,
      direction: null,
    };
  }

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
  const reversalSignals = collectReversalSignals(side, currentPrice, entryMid, macro);

  if (inZone) {
    if (macro?.mtfEntryBlocked) {
      return {
        status: "watch",
        headline: "上位足が逆方向のため様子見",
        detail:
          `$${low.toLocaleString()} 〜 $${high.toLocaleString()} の帯内ですが、` +
          (macro.mtfGateSummary ?? "週足・日足がエントリー方向と一致していません。"),
        action:
          "新規エントリーは見送り、上位足の方向が揃うか、日足・4時間足で再整理されるのを待ちましょう。" +
          macroNote,
        distanceUsd: 0,
        distancePct: 0,
        direction: null,
      };
    }

    if (macro?.mtfEntryTimingReady === false) {
      return {
        status: "wait_timing",
        headline: "帯内ですが1時間足の確認待ち",
        detail:
          `エントリー帯には入っています。${macro.mtfGateSummary ?? "1時間足でタイミングを確認してください。"}`,
        action:
          (side === "long"
            ? "1時間足でGCや押し目完了のサインを待ってから、ロングを検討しましょう。"
            : "1時間足でDCや戻り売りのサインを待ってから、ショートを検討しましょう。") + macroNote,
        distanceUsd: 0,
        distancePct: 0,
        direction: null,
      };
    }

    const cautionParts: string[] = [];
    if (reversalSignals.length > 0) {
      cautionParts.push(reversalSignals.join("・"));
    }
    if (macro?.mtfNearHtfBarrier) {
      cautionParts.push(macro.mtfCaution ?? "週足の主要水準が近い");
    }
    const caution = cautionParts.length > 0 ? ` ただし ${cautionParts.join("・")} のため、サイズは控えめに。` : "";
    return {
      status: "in_zone",
      headline: "エントリー帯に入りました",
      detail: `$${low.toLocaleString()} 〜 $${high.toLocaleString()} の範囲にいます。${caution}`,
      action:
        (side === "long"
          ? "ロングの新規エントリーを検討しましょう。"
          : side === "short"
            ? "ショートの新規エントリーを検討しましょう。"
            : "新規エントリーを検討しましょう。") +
        " SL・TPは下の目安を参照し、自分のルールでサイズを決めてください。" +
        macroNote,
      distanceUsd: 0,
      distancePct: 0,
      direction: null,
    };
  }

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

  if (
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
    if (macro?.usdtDominanceTrend === "rising") signals.push("USDT.Dが上昇（リスクオフ）");
    if (macro?.stochCross === "dc" || (macro?.stochK != null && macro.stochK >= 80)) {
      signals.push("ストキャスが戻り売り寄り");
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
    if (macro?.usdtDominanceTrend === "falling") signals.push("USDT.Dが低下（リスクオン）");
    if (macro?.stochCross === "gc" || (macro?.stochK != null && macro.stochK <= 20)) {
      signals.push("ストキャスが反発寄り");
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
  if (macro.usdtDominanceTrend === "rising") parts.push("USDT.Dは上昇傾向");
  if (macro.usdtDominanceTrend === "falling") parts.push("USDT.Dは低下傾向");
  if (macro.stochCross === "gc") parts.push("ストキャス直近GC");
  if (macro.stochCross === "dc") parts.push("ストキャス直近DC");
  if (!parts.length) return "";
  return `（${parts.join("・")}）`;
}
