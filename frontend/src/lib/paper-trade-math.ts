import type {
  PaperTrade,
  PaperTradePeriod,
  PaperTradeStats,
  PaperTradeStatus,
  PaperTradeTakeProfitTarget,
} from "../types/paper-trade";

export function isPaperTradeOpen(trade: PaperTrade): boolean {
  return trade.status === "open";
}

export function unrealizedPnlUsd(trade: PaperTrade, currentPrice: number): number {
  if (!isPaperTradeOpen(trade) || currentPrice <= 0) return 0;
  const diff =
    trade.side === "long" ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;
  return diff * trade.sizeBtc;
}

export function realizedPnlFromExit(
  side: PaperTrade["side"],
  entryPrice: number,
  exitPrice: number,
  sizeBtc: number,
): number {
  const diff = side === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return diff * sizeBtc;
}

export interface PaperTradeResolution {
  exitPrice: number;
  status: Exclude<PaperTradeStatus, "open" | "closed_manual">;
}

/** Check if current price triggers SL or the selected TP for an open position. */
export function resolvePaperTradeExit(
  trade: PaperTrade,
  price: number,
): PaperTradeResolution | null {
  if (!isPaperTradeOpen(trade) || price <= 0) return null;

  const { side, stopLoss, takeProfit1, takeProfit2 } = trade;
  const target = trade.takeProfitTarget ?? "tp1";

  if (side === "long") {
    if (price <= stopLoss) return { exitPrice: stopLoss, status: "closed_sl" };
    if (target === "tp2" && takeProfit2 != null && price >= takeProfit2) {
      return { exitPrice: takeProfit2, status: "closed_tp2" };
    }
    if (target === "tp1" && takeProfit1 != null && price >= takeProfit1) {
      return { exitPrice: takeProfit1, status: "closed_tp1" };
    }
    return null;
  }

  if (price >= stopLoss) return { exitPrice: stopLoss, status: "closed_sl" };
  if (target === "tp2" && takeProfit2 != null && price <= takeProfit2) {
    return { exitPrice: takeProfit2, status: "closed_tp2" };
  }
  if (target === "tp1" && takeProfit1 != null && price <= takeProfit1) {
    return { exitPrice: takeProfit1, status: "closed_tp1" };
  }
  return null;
}

export function takeProfitTargetLabel(target: PaperTradeTakeProfitTarget): string {
  return target === "tp1" ? "TP1" : "TP2";
}

export function filterPaperTradesByPeriod(
  trades: PaperTrade[],
  period: PaperTradePeriod,
  now = new Date(),
): PaperTrade[] {
  if (period === "all") return trades;

  const start = new Date(now);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(start.getDate() - 30);
  }

  return trades.filter((t) => {
    const anchor = t.closedAt ?? t.openedAt;
    return anchor != null && anchor >= start;
  });
}

export function summarizePaperTrades(trades: PaperTrade[]): PaperTradeStats {
  const closed = trades.filter((t) => !isPaperTradeOpen(t));
  const openCount = trades.length - closed.length;

  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;
  let totalRealizedPnlUsd = 0;
  const wins: number[] = [];
  const losses: number[] = [];

  for (const t of closed) {
    const pnl = t.realizedPnlUsd ?? 0;
    totalRealizedPnlUsd += pnl;
    if (pnl > 0.01) {
      winCount += 1;
      wins.push(pnl);
    } else if (pnl < -0.01) {
      lossCount += 1;
      losses.push(pnl);
    } else {
      breakevenCount += 1;
    }
  }

  const decided = winCount + lossCount;
  const winRatePct = decided > 0 ? Math.round((winCount / decided) * 1000) / 10 : null;

  return {
    openCount,
    closedCount: closed.length,
    winCount,
    lossCount,
    breakevenCount,
    winRatePct,
    totalRealizedPnlUsd: Math.round(totalRealizedPnlUsd * 100) / 100,
    avgWinUsd: wins.length ? Math.round((wins.reduce((a, b) => a + b, 0) / wins.length) * 100) / 100 : null,
    avgLossUsd: losses.length
      ? Math.round((losses.reduce((a, b) => a + b, 0) / losses.length) * 100) / 100
      : null,
  };
}

export function statusLabelJa(status: PaperTradeStatus): string {
  switch (status) {
    case "open":
      return "保有中";
    case "closed_tp1":
      return "TP1決済";
    case "closed_tp2":
      return "TP2決済";
    case "closed_sl":
      return "SL決済";
    case "closed_manual":
      return "手動決済";
    default:
      return status;
  }
}
