import type { EntryZone, ExitStrategy, TradeSide } from "../types/scenario";

/** エントリー価格の基準（帯のどこを使うか）。 */
export type EntryBasis = "low" | "mid" | "high";

export interface PositionSizingInput {
  /** 口座残高（USD / USDT 建て）。シナリオの価格が USD のため USD で統一する。 */
  accountBalance: number;
  /** 1 トレードで許容する損失（口座残高に対する %）。例: 1 = 1%。 */
  riskPct: number;
  /** エントリー価格の基準。 */
  entryBasis: EntryBasis;
}

export interface TpResult {
  /** 0 始まりの TP インデックス（表示は +1）。 */
  index: number;
  price: number;
  /** リスクに対する到達倍率（R 倍数）。 */
  rMultiple: number;
  /** この TP で利確した場合の想定利益（USD）。 */
  rewardAmount: number;
}

export interface PositionSizingResult {
  side: TradeSide;
  entryPrice: number;
  stopLoss: number;
  /** 1 BTC あたりの損失幅（USD）。 */
  riskPerUnit: number;
  /** 建てるべき数量（BTC）。 */
  positionSizeBtc: number;
  /** 想定建玉サイズ（USD）。 */
  positionNotionalUsd: number;
  /** 損失許容額（USD）。 */
  riskAmountUsd: number;
  takeProfits: TpResult[];
  valid: boolean;
  invalidReason?: string;
}

export const DEFAULT_POSITION_SIZING: PositionSizingInput = {
  accountBalance: 10000,
  riskPct: 1,
  entryBasis: "mid",
};

const STORAGE_KEY = "positionSizingPrefs";

export function loadPositionSizingPrefs(): PositionSizingInput {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_POSITION_SIZING };
    const parsed = JSON.parse(raw) as Partial<PositionSizingInput>;
    const accountBalance =
      typeof parsed.accountBalance === "number" && parsed.accountBalance > 0
        ? parsed.accountBalance
        : DEFAULT_POSITION_SIZING.accountBalance;
    const riskPct =
      typeof parsed.riskPct === "number" && parsed.riskPct > 0
        ? parsed.riskPct
        : DEFAULT_POSITION_SIZING.riskPct;
    const entryBasis: EntryBasis =
      parsed.entryBasis === "low" || parsed.entryBasis === "high" || parsed.entryBasis === "mid"
        ? parsed.entryBasis
        : DEFAULT_POSITION_SIZING.entryBasis;
    return { accountBalance, riskPct, entryBasis };
  } catch {
    return { ...DEFAULT_POSITION_SIZING };
  }
}

export function savePositionSizingPrefs(input: PositionSizingInput): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
  } catch {
    // ignore persistence failures
  }
}

export function resolveEntryPrice(entry: EntryZone, basis: EntryBasis): number {
  if (basis === "low") return entry.zone_low;
  if (basis === "high") return entry.zone_high;
  return (entry.zone_low + entry.zone_high) / 2;
}

/**
 * リスク固定（残高の一定 %）でポジションサイズを計算する。
 * 執行はせず、取引所に手入力するための数量・リスク額・各 TP の R 倍数を返す。
 */
export function computePositionSizing(
  entry: EntryZone,
  exit: ExitStrategy,
  input: PositionSizingInput,
): PositionSizingResult {
  const side = entry.side;
  const entryPrice = resolveEntryPrice(entry, input.entryBasis);
  const stopLoss = exit.stop_loss;
  const riskPerUnit = side === "short" ? stopLoss - entryPrice : entryPrice - stopLoss;
  const riskAmountUsd = input.accountBalance * (input.riskPct / 100);

  const base: PositionSizingResult = {
    side,
    entryPrice,
    stopLoss,
    riskPerUnit,
    positionSizeBtc: 0,
    positionNotionalUsd: 0,
    riskAmountUsd,
    takeProfits: [],
    valid: false,
  };

  if (side === "neutral") {
    return { ...base, invalidReason: "中立シナリオのため数量計算は行いません。" };
  }
  if (!Number.isFinite(entryPrice) || !Number.isFinite(stopLoss) || !Number.isFinite(riskAmountUsd)) {
    return { ...base, invalidReason: "価格または残高が不正です。" };
  }
  if (riskPerUnit <= 0) {
    return {
      ...base,
      invalidReason:
        side === "long"
          ? "損切りがエントリーより上にあります（ロングの設定として不正）。"
          : "損切りがエントリーより下にあります（ショートの設定として不正）。",
    };
  }
  if (riskAmountUsd <= 0) {
    return { ...base, invalidReason: "残高とリスク % を入力してください。" };
  }

  const positionSizeBtc = riskAmountUsd / riskPerUnit;
  const positionNotionalUsd = positionSizeBtc * entryPrice;

  const takeProfits: TpResult[] = exit.take_profit.map((price, index) => {
    const rewardPerUnit = side === "short" ? entryPrice - price : price - entryPrice;
    return {
      index,
      price,
      rMultiple: rewardPerUnit / riskPerUnit,
      rewardAmount: positionSizeBtc * rewardPerUnit,
    };
  });

  return {
    ...base,
    positionSizeBtc,
    positionNotionalUsd,
    takeProfits,
    valid: true,
  };
}

/** 取引所へ貼り付ける用に、記号・カンマ無しの数値文字列を返す。 */
export function toCopyNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(decimals);
}

/** BTC 数量の表示・コピー用フォーマット（最大 6 桁、末尾ゼロ除去）。 */
export function formatBtcQty(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = value.toFixed(6);
  return fixed.replace(/\.?0+$/, "");
}

/** USD 金額の表示用フォーマット（$ 付き・カンマ区切り）。 */
export function formatUsd(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}
