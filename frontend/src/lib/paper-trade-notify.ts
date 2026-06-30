import { api } from "../api/client";
import type { PaperTrade, PaperTradeStatus } from "../types/paper-trade";
import { realizedPnlFromExit, statusLabelJa } from "./paper-trade-math";

type AutoCloseStatus = Exclude<PaperTradeStatus, "open" | "closed_manual">;

export async function notifyPaperTradeFill(
  trade: PaperTrade,
  exitPrice: number,
  status: AutoCloseStatus,
): Promise<void> {
  const realizedPnlUsd = realizedPnlFromExit(
    trade.side,
    trade.entryPrice,
    exitPrice,
    trade.sizeBtc,
  );

  try {
    await api.notifyPaperTradeFill({
      side: trade.side,
      entryPrice: trade.entryPrice,
      exitPrice,
      sizeBtc: trade.sizeBtc,
      stopLoss: trade.stopLoss,
      takeProfit1: trade.takeProfit1,
      takeProfit2: trade.takeProfit2,
      takeProfitTarget: trade.takeProfitTarget,
      status,
      statusLabelJa: statusLabelJa(status),
      label: trade.label,
      realizedPnlUsd,
    });
  } catch (error) {
    console.warn("paper trade fill notification failed", error);
  }
}
