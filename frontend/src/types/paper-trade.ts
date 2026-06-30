import type { TradeSide } from "./scenario";

export type PaperTradeStatus =
  | "open"
  | "closed_tp1"
  | "closed_tp2"
  | "closed_sl"
  | "closed_manual";

export type PaperTradePeriod = "today" | "week" | "month" | "all";

/** 自動決済で使う利確ライン（SL は常に有効）。 */
export type PaperTradeTakeProfitTarget = "tp1" | "tp2";

export interface PaperTrade {
  id: string;
  side: Exclude<TradeSide, "neutral">;
  status: PaperTradeStatus;
  entryPrice: number;
  sizeBtc: number;
  stopLoss: number;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfitTarget: PaperTradeTakeProfitTarget;
  exitPrice: number | null;
  realizedPnlUsd: number | null;
  label: string;
  scenarioBranch: string | null;
  horizonId: string | null;
  openedAt: Date | null;
  closedAt: Date | null;
  updatedAt: Date | null;
}

export interface PaperTradeInput {
  side: Exclude<TradeSide, "neutral">;
  entryPrice: number;
  sizeBtc: number;
  stopLoss: number;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfitTarget: PaperTradeTakeProfitTarget;
  label: string;
  scenarioBranch: string | null;
  horizonId: string | null;
}

export interface PaperTradeDraft {
  side: Exclude<TradeSide, "neutral">;
  entryPrice: number;
  sizeBtc: number;
  stopLoss: number;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfitTarget: PaperTradeTakeProfitTarget;
  label: string;
}

export interface PaperTradeStats {
  openCount: number;
  closedCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRatePct: number | null;
  totalRealizedPnlUsd: number;
  avgWinUsd: number | null;
  avgLossUsd: number | null;
}

export interface PaperTradeFillNotifyRequest {
  side: Exclude<TradeSide, "neutral">;
  entryPrice: number;
  exitPrice: number;
  sizeBtc: number;
  stopLoss: number;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfitTarget: PaperTradeTakeProfitTarget;
  status: Exclude<PaperTradeStatus, "open" | "closed_manual">;
  statusLabelJa: string;
  label: string;
  realizedPnlUsd: number;
}
