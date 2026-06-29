from __future__ import annotations

from app.schemas.market import NormalizedOrderBook
from app.schemas.scenario import TradeSide

# Venues quoted in USD/USDT for orderbook + scenario math.
USD_ORDERBOOK_EXCHANGES = frozenset({"whitebit", "binance", "coinbase", "bybit", "bitget"})


def is_plausible_usd_price(
    level: float,
    reference: float,
    *,
    min_ratio: float = 0.75,
    max_ratio: float = 1.25,
) -> bool:
    if reference <= 0 or level <= 0:
        return False
    return min_ratio * reference <= level <= max_ratio * reference


def filter_usd_orderbooks(
    orderbooks: list[NormalizedOrderBook],
    reference_price: float | None = None,
) -> list[NormalizedOrderBook]:
    filtered = [ob for ob in orderbooks if ob.exchange in USD_ORDERBOOK_EXCHANGES]
    if reference_price is None or reference_price <= 0:
        return filtered

    sane: list[NormalizedOrderBook] = []
    for ob in filtered:
        sample = [float(level.price) for level in (ob.bids[:3] + ob.asks[:3])]
        if not sample:
            sane.append(ob)
            continue
        if any(is_plausible_usd_price(p, reference_price, min_ratio=0.5, max_ratio=2.0) for p in sample):
            sane.append(ob)
    return sane


def clamp_level(level: float, reference: float, min_ratio: float, max_ratio: float) -> float:
    if reference <= 0:
        return level
    lo, hi = reference * min_ratio, reference * max_ratio
    return round(min(hi, max(lo, level)), 2)


def clamp_exit_levels(
    entry_ref: float,
    spot_price: float,
    side: TradeSide,
    take_profit: list[float],
    stop_loss: float,
) -> tuple[list[float], float]:
    """Keep scenario exit levels within a realistic swing-trade band."""
    ref = entry_ref if entry_ref > 0 else spot_price
    if ref <= 0:
        return take_profit, stop_loss

    if side == "short":
        stop_loss = clamp_level(stop_loss, ref, 1.003, 1.08)
        take_profit = sorted(
            {clamp_level(tp, ref, 0.90, 0.999) for tp in take_profit if tp < ref},
            reverse=True,
        )
    elif side == "long":
        stop_loss = clamp_level(stop_loss, ref, 0.92, 0.997)
        take_profit = sorted({clamp_level(tp, ref, 1.003, 1.10) for tp in take_profit if tp > ref})
    else:
        stop_loss = clamp_level(stop_loss, ref, 0.95, 1.05)
        take_profit = [clamp_level(tp, ref, 0.98, 1.02) for tp in take_profit]

    return take_profit, stop_loss
