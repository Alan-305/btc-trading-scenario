from __future__ import annotations

from dataclasses import dataclass

from app.schemas.market import NormalizedOrderBook
from app.services.price_sanity import USD_ORDERBOOK_EXCHANGES, is_plausible_usd_price

# Volume-weighted priority for composite spot order-book sentiment.
EXCHANGE_IMBALANCE_WEIGHTS: dict[str, float] = {
    "binance": 0.40,
    "bybit": 0.25,
    "coinbase": 0.15,
    "whitebit": 0.10,
    "bitget": 0.10,
}

NEAR_PRICE_BAND_PCT = 0.01  # ±1% around reference — aligns with short-term entry context


@dataclass
class OrderbookImbalanceResult:
    imbalance: float
    exchanges_used: list[str]
    detail_ja: str


def compute_weighted_orderbook_imbalance(
    orderbooks: list[NormalizedOrderBook],
    reference_price: float,
    *,
    band_pct: float = NEAR_PRICE_BAND_PCT,
) -> OrderbookImbalanceResult:
    """Composite bid/ask imbalance from multiple USD venues, near touch only."""
    if reference_price <= 0:
        return OrderbookImbalanceResult(
            imbalance=0.0,
            exchanges_used=[],
            detail_ja="板データなし",
        )

    weighted_sum = 0.0
    weight_total = 0.0
    used: list[str] = []

    for ob in orderbooks:
        if ob.exchange not in USD_ORDERBOOK_EXCHANGES:
            continue
        weight = EXCHANGE_IMBALANCE_WEIGHTS.get(ob.exchange)
        if weight is None:
            continue

        local = _exchange_near_touch_imbalance(ob, reference_price, band_pct)
        if local is None:
            continue

        weighted_sum += weight * local
        weight_total += weight
        used.append(ob.exchange)

    if weight_total <= 0:
        return OrderbookImbalanceResult(
            imbalance=0.0,
            exchanges_used=[],
            detail_ja="現値近傍の板データなし",
        )

    imbalance = weighted_sum / weight_total
    labels = [_exchange_label(ex) for ex in used]
    detail = f"{'・'.join(labels)}の現値±{band_pct * 100:.0f}%板を加重合成"
    return OrderbookImbalanceResult(
        imbalance=round(imbalance, 4),
        exchanges_used=used,
        detail_ja=detail,
    )


def _exchange_near_touch_imbalance(
    ob: NormalizedOrderBook,
    reference_price: float,
    band_pct: float,
) -> float | None:
    low = reference_price * (1 - band_pct)
    high = reference_price * (1 + band_pct)

    bid_vol = 0.0
    for level in ob.bids:
        price = float(level.price)
        if not is_plausible_usd_price(price, reference_price, min_ratio=1 - band_pct * 1.5, max_ratio=1.0):
            continue
        if low <= price <= reference_price:
            bid_vol += float(level.size)

    ask_vol = 0.0
    for level in ob.asks:
        price = float(level.price)
        if not is_plausible_usd_price(price, reference_price, min_ratio=1.0, max_ratio=1 + band_pct * 1.5):
            continue
        if reference_price <= price <= high:
            ask_vol += float(level.size)

    total = bid_vol + ask_vol
    if total <= 0:
        return None
    return (bid_vol - ask_vol) / total


def _exchange_label(exchange: str) -> str:
    return {
        "binance": "Binance",
        "bybit": "Bybit",
        "coinbase": "Coinbase",
        "whitebit": "WhiteBIT",
        "bitget": "Bitget",
    }.get(exchange, exchange)
