from __future__ import annotations

from decimal import Decimal

from app.schemas.market import MarketSnapshot


def reference_price_from_snapshot(snapshot: MarketSnapshot) -> float:
    baseline = next((t for t in snapshot.tickers if t.exchange == "whitebit"), None)
    if baseline is None and snapshot.tickers:
        baseline = snapshot.tickers[0]
    if baseline is None:
        return 0.0
    return float(Decimal(baseline.last_price))
