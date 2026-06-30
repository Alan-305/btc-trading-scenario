from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

PaperTradeSide = Literal["long", "short"]
PaperTradeStatus = Literal["open", "closed_tp1", "closed_tp2", "closed_sl", "closed_manual"]
AutoCloseStatus = Literal["closed_tp1", "closed_tp2", "closed_sl"]
TakeProfitTarget = Literal["tp1", "tp2"]


@dataclass(frozen=True)
class PaperTradeState:
    side: PaperTradeSide
    status: PaperTradeStatus
    entry_price: float
    size_btc: float
    stop_loss: float
    take_profit1: float | None
    take_profit2: float | None
    take_profit_target: TakeProfitTarget = "tp1"


@dataclass(frozen=True)
class PaperTradeResolution:
    exit_price: float
    status: AutoCloseStatus


def is_paper_trade_open(trade: PaperTradeState) -> bool:
    return trade.status == "open"


def realized_pnl_usd(
    side: PaperTradeSide,
    entry_price: float,
    exit_price: float,
    size_btc: float,
) -> float:
    diff = exit_price - entry_price if side == "long" else entry_price - exit_price
    return diff * size_btc


def resolve_paper_trade_exit(trade: PaperTradeState, price: float) -> PaperTradeResolution | None:
    if not is_paper_trade_open(trade) or price <= 0:
        return None

    side = trade.side
    stop_loss = trade.stop_loss
    take_profit1 = trade.take_profit1
    take_profit2 = trade.take_profit2
    target = trade.take_profit_target

    if side == "long":
        if price <= stop_loss:
            return PaperTradeResolution(exit_price=stop_loss, status="closed_sl")
        if target == "tp2" and take_profit2 is not None and price >= take_profit2:
            return PaperTradeResolution(exit_price=take_profit2, status="closed_tp2")
        if target == "tp1" and take_profit1 is not None and price >= take_profit1:
            return PaperTradeResolution(exit_price=take_profit1, status="closed_tp1")
        return None

    if price >= stop_loss:
        return PaperTradeResolution(exit_price=stop_loss, status="closed_sl")
    if target == "tp2" and take_profit2 is not None and price <= take_profit2:
        return PaperTradeResolution(exit_price=take_profit2, status="closed_tp2")
    if target == "tp1" and take_profit1 is not None and price <= take_profit1:
        return PaperTradeResolution(exit_price=take_profit1, status="closed_tp1")
    return None


def status_label_ja(status: AutoCloseStatus) -> str:
    return {
        "closed_tp1": "TP1決済",
        "closed_tp2": "TP2決済",
        "closed_sl": "SL決済",
    }[status]
