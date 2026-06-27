from __future__ import annotations

from decimal import Decimal

from app.config import get_settings
from app.schemas.market import MarketSnapshot, NormalizedTicker


class DivergenceService:
    """Compute price divergence vs baseline exchange (default: WhiteBIT)."""

    def __init__(self, baseline_exchange: str | None = None):
        settings = get_settings()
        self.baseline_exchange = baseline_exchange or settings.baseline_exchange

    def apply(self, snapshot: MarketSnapshot) -> MarketSnapshot:
        baseline = self._find_baseline(snapshot.tickers)
        if baseline is None:
            snapshot.divergence_pct = {}
            return snapshot

        baseline_price = float(baseline.last_price)
        if baseline_price <= 0:
            snapshot.divergence_pct = {}
            return snapshot

        divergence: dict[str, float] = {}
        for ticker in snapshot.tickers:
            if ticker.exchange == self.baseline_exchange:
                divergence[ticker.exchange] = 0.0
                continue
            price = float(ticker.last_price)
            # bitbank is JPY — skip cross-currency naive comparison in divergence map
            if ticker.exchange == "bitbank":
                divergence[ticker.exchange] = 0.0
                continue
            pct = ((price - baseline_price) / baseline_price) * 100.0
            divergence[ticker.exchange] = round(pct, 4)

        snapshot.divergence_pct = divergence
        return snapshot

    def _find_baseline(self, tickers: list[NormalizedTicker]) -> NormalizedTicker | None:
        for t in tickers:
            if t.exchange == self.baseline_exchange:
                return t
        return tickers[0] if tickers else None

    @staticmethod
    def max_divergence_pct(divergence_pct: dict[str, float]) -> float:
        if not divergence_pct:
            return 0.0
        return max(abs(v) for v in divergence_pct.values())
