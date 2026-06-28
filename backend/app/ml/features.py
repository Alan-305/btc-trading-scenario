from __future__ import annotations

from dataclasses import dataclass

from app.config import get_settings
from app.schemas.market import CoinglassSnapshot, FearGreedIndex, MarketSnapshot
from app.services.divergence import DivergenceService
from app.services.orderbook_imbalance import compute_weighted_orderbook_imbalance
from app.services.scenario_context import reference_price_from_snapshot


@dataclass
class FeatureVector:
    reference_price: float
    reference_exchange: str
    spread_pct: float
    bid_ask_imbalance: float
    orderbook_imbalance_detail: str
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
        price = reference_price_from_snapshot(snapshot) if snapshot.tickers else 0.0
        if baseline and price <= 0:
            price = float(baseline.last_price)

        bid = float(baseline.bid) if baseline and baseline.bid else price
        ask = float(baseline.ask) if baseline and baseline.ask else price
        spread_pct = ((ask - bid) / price * 100) if price > 0 else 0.0

        ob_result = compute_weighted_orderbook_imbalance(snapshot.orderbooks, price)

        return FeatureVector(
            reference_price=price,
            reference_exchange=baseline.exchange if baseline else get_settings().baseline_exchange,
            spread_pct=spread_pct,
            bid_ask_imbalance=ob_result.imbalance,
            orderbook_imbalance_detail=ob_result.detail_ja,
            fear_greed=fear_greed.value if fear_greed else None,
            funding_rate=coinglass.funding_rate if coinglass else None,
            divergence_max_pct=DivergenceService.max_divergence_pct(snapshot.divergence_pct),
        )

    def _baseline_ticker(self, snapshot: MarketSnapshot):
        baseline_exchange = get_settings().baseline_exchange
        for t in snapshot.tickers:
            if t.exchange == baseline_exchange:
                return t
        return snapshot.tickers[0] if snapshot.tickers else None
