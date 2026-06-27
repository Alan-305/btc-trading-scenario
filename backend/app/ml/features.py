from __future__ import annotations

from dataclasses import dataclass

from app.schemas.market import CoinglassSnapshot, FearGreedIndex, MarketSnapshot
from app.services.divergence import DivergenceService


@dataclass
class FeatureVector:
    reference_price: float
    spread_pct: float
    bid_ask_imbalance: float
    fear_greed: int | None
    funding_rate: float | None
    divergence_max_pct: float


class FeatureEngine:
    def extract(
        self,
        snapshot: MarketSnapshot,
        fear_greed: FearGreedIndex | None,
        coinglass: CoinglassSnapshot | None,
    ) -> FeatureVector:
        baseline = self._baseline_ticker(snapshot)
        price = float(baseline.last_price) if baseline else 0.0

        bid = float(baseline.bid) if baseline and baseline.bid else price
        ask = float(baseline.ask) if baseline and baseline.ask else price
        spread_pct = ((ask - bid) / price * 100) if price > 0 else 0.0

        imbalance = self._orderbook_imbalance(snapshot, baseline.exchange if baseline else "whitebit")

        return FeatureVector(
            reference_price=price,
            spread_pct=spread_pct,
            bid_ask_imbalance=imbalance,
            fear_greed=fear_greed.value if fear_greed else None,
            funding_rate=coinglass.funding_rate if coinglass else None,
            divergence_max_pct=DivergenceService.max_divergence_pct(snapshot.divergence_pct),
        )

    def _baseline_ticker(self, snapshot: MarketSnapshot):
        for t in snapshot.tickers:
            if t.exchange == "whitebit":
                return t
        return snapshot.tickers[0] if snapshot.tickers else None

    def _orderbook_imbalance(self, snapshot: MarketSnapshot, exchange: str) -> float:
        for ob in snapshot.orderbooks:
            if ob.exchange == exchange:
                bid_vol = sum(float(l.size) for l in ob.bids)
                ask_vol = sum(float(l.size) for l in ob.asks)
                total = bid_vol + ask_vol
                if total <= 0:
                    return 0.0
                return (bid_vol - ask_vol) / total
        return 0.0
