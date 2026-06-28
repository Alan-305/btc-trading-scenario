from datetime import datetime, timezone
from decimal import Decimal

from app.schemas.market import NormalizedOrderBook, OrderBookLevel
from app.services.orderbook_imbalance import compute_weighted_orderbook_imbalance


def _ob(exchange: str, bids: list[tuple[float, float]], asks: list[tuple[float, float]]) -> NormalizedOrderBook:
    now = datetime.now(timezone.utc)
    return NormalizedOrderBook(
        exchange=exchange,  # type: ignore[arg-type]
        symbol="BTC",
        bids=[OrderBookLevel(price=Decimal(str(p)), size=Decimal(str(s))) for p, s in bids],
        asks=[OrderBookLevel(price=Decimal(str(p)), size=Decimal(str(s))) for p, s in asks],
        timestamp=now,
    )


def test_composite_imbalance_bid_heavy_near_touch():
    ref = 100_000.0
    books = [
        _ob(
            "binance",
            bids=[(99_500, 10), (50_000, 100)],  # deep bogus level ignored
            asks=[(100_500, 2)],
        ),
        _ob(
            "bybit",
            bids=[(99_800, 5)],
            asks=[(100_200, 1)],
        ),
    ]
    result = compute_weighted_orderbook_imbalance(books, ref)
    assert result.imbalance > 0.3
    assert "binance" in result.exchanges_used
    assert "bybit" in result.exchanges_used


def test_composite_imbalance_ask_heavy():
    ref = 100_000.0
    books = [
        _ob("binance", bids=[(99_900, 1)], asks=[(100_100, 20), (100_500, 5)]),
    ]
    result = compute_weighted_orderbook_imbalance(books, ref)
    assert result.imbalance < -0.3


def test_ignores_levels_outside_near_band():
    ref = 100_000.0
    books = [
        _ob(
            "binance",
            bids=[(90_000, 1000)],  # too far below
            asks=[(110_000, 1000)],  # too far above
        ),
    ]
    result = compute_weighted_orderbook_imbalance(books, ref)
    assert result.exchanges_used == []
    assert result.imbalance == 0.0
