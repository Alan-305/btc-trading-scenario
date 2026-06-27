from __future__ import annotations

from dataclasses import dataclass

from app.ml.features import FeatureEngine
from app.schemas.market import CoinglassSnapshot, FearGreedIndex, MarketSnapshot
from app.schemas.scenario import MacroTrend, TradeSide


@dataclass
class InferenceSignal:
    macro_trend: MacroTrend
    confidence: float
    side: TradeSide
    entry_low: float
    entry_high: float
    take_profit: list[float]
    stop_loss: float
    forecast_prices: list[float]
    entry_rationale: str
    exit_rationale: str


class ScenarioInference:
    """Rule-based + feature-driven signal engine (ML-ready structure)."""

    def __init__(self):
        self.features = FeatureEngine()

    def predict(
        self,
        snapshot: MarketSnapshot,
        fear_greed: FearGreedIndex | None,
        coinglass: CoinglassSnapshot | None,
    ) -> InferenceSignal:
        feat = self.features.extract(snapshot, fear_greed, coinglass)
        price = feat.reference_price
        spread_pct = feat.spread_pct
        fg = feat.fear_greed or 50
        funding = feat.funding_rate or 0.0

        bullish_score = 0
        bearish_score = 0

        if fg >= 55:
            bullish_score += 1
        elif fg <= 45:
            bearish_score += 1

        if funding > 0.01:
            bearish_score += 1
        elif funding < -0.01:
            bullish_score += 1

        if feat.bid_ask_imbalance > 0.05:
            bullish_score += 1
        elif feat.bid_ask_imbalance < -0.05:
            bearish_score += 1

        if bullish_score > bearish_score:
            macro_trend: MacroTrend = "bullish"
            side: TradeSide = "long"
        elif bearish_score > bullish_score:
            macro_trend = "bearish"
            side = "short"
        else:
            macro_trend = "range"
            side = "neutral"

        total = bullish_score + bearish_score + 1
        confidence = round(max(bullish_score, bearish_score) / total, 2)
        confidence = max(0.35, min(0.85, confidence))

        entry_low = round(price * (0.995 if side == "long" else 1.005), 2)
        entry_high = round(price * (1.005 if side == "long" else 0.995), 2)

        if side == "long":
            take_profit = [round(price * 1.02, 2), round(price * 1.04, 2)]
            stop_loss = round(price * 0.97, 2)
        elif side == "short":
            take_profit = [round(price * 0.98, 2), round(price * 0.96, 2)]
            stop_loss = round(price * 1.03, 2)
        else:
            take_profit = [round(price * 1.01, 2)]
            stop_loss = round(price * 0.99, 2)

        forecast_prices = [
            round(price * (1 + 0.005 * (i + 1) * (1 if macro_trend == "bullish" else -1 if macro_trend == "bearish" else 0)), 2)
            for i in range(6)
        ]

        entry_rationale = (
            f"基準価格 {price:,.0f} 付近。スプレッド {spread_pct:.3f}%・板の偏りを考慮したエントリー帯です。"
        )
        exit_rationale = (
            "想定抵抗帯とリスク許容幅から利確・損切り水準を設定しています。"
        )

        return InferenceSignal(
            macro_trend=macro_trend,
            confidence=confidence,
            side=side,
            entry_low=min(entry_low, entry_high),
            entry_high=max(entry_low, entry_high),
            take_profit=take_profit,
            stop_loss=stop_loss,
            forecast_prices=forecast_prices,
            entry_rationale=entry_rationale,
            exit_rationale=exit_rationale,
        )
