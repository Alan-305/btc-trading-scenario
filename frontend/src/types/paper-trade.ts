import type { TradeSide } from "./scenario";

export type PaperTradeStatus =
  | "open"
  | "closed_tp1"
  | "closed_tp2"
  | "closed_sl"
  | "closed_manual";

export type PaperTradePeriod = "today" | "week" | "month" | "all";

export interface PaperTrade {
  id: string;
  side: Exclude<TradeSide, "neutral">;
  status: PaperTradeStatus;
  entryPrice: number;
  sizeBtc: number;
  stopLoss: number;
  takeProfit1: number | null;
  takeProfit2: number | null;
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
