from __future__ import annotations

from dataclasses import dataclass

from app.ml.features import FeatureEngine
from app.schemas.market import CoinglassSnapshot, FearGreedIndex, MarketSnapshot
from app.schemas.scenario import MacroTrend, TradeSide
from app.services.scenario_market_context import ScenarioMarketContext
from app.services.price_sanity import clamp_exit_levels, is_plausible_usd_price


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
    """Rule-based signal engine using full dashboard market context + user research."""

    def __init__(self):
        self.features = FeatureEngine()

    def predict(
        self,
        snapshot: MarketSnapshot,
        fear_greed: FearGreedIndex | None,
        coinglass: CoinglassSnapshot | None,
        context: ScenarioMarketContext,
    ) -> InferenceSignal:
        feat = self.features.extract(snapshot, fear_greed, coinglass)
        price = feat.reference_price
        spread_pct = feat.spread_pct
        fg = feat.fear_greed or 50
        funding = feat.funding_rate or 0.0
        ta = context.technical

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

        ta_trend = ta.trend if ta else None
        if ta_trend == "bullish":
            bullish_score += 2
        elif ta_trend == "bearish":
            bearish_score += 2

        if ta and ta.rsi_14 is not None:
            if ta.rsi_14 < 35:
                bullish_score += 1
            elif ta.rsi_14 > 65:
                bearish_score += 1

        if ta and ta.macd:
            if ta.macd.histogram > 0:
                bullish_score += 1
            elif ta.macd.histogram < 0:
                bearish_score += 1

        if ta and ta.ema_20 is not None and ta.ema_50 is not None:
            if ta.ema_20 > ta.ema_50:
                bullish_score += 1
            elif ta.ema_20 < ta.ema_50:
                bearish_score += 1

        if ta and ta.ema_200 is not None and price > 0:
            if price > ta.ema_200:
                bullish_score += 1
            elif price < ta.ema_200:
                bearish_score += 1

        ls_ratio = coinglass.long_short_ratio if coinglass else None
        if ls_ratio is None and coinglass and coinglass.exchanges:
            for ex in coinglass.exchanges:
                if ex.long_short_ratio is not None:
                    ls_ratio = ex.long_short_ratio
                    break
        if ls_ratio is not None:
            if ls_ratio > 1.15:
                bearish_score += 1
            elif ls_ratio < 0.85:
                bullish_score += 1

        if context.heatmap:
            if context.heatmap.bid_heavy_below_price:
                bullish_score += 1
            if context.heatmap.ask_heavy_above_price:
                bearish_score += 1

        for item in context.research:
            ctx = (item.market_context or "").lower()
            if ctx == "bullish":
                bullish_score += 2
            elif ctx == "bearish":
                bearish_score += 2
            elif ctx == "range":
                pass

        if context.etf_flows:
            trend = context.etf_flows.trend
            if trend == "inflow":
                bullish_score += 2
            elif trend == "outflow":
                bearish_score += 2

        if context.options:
            pc = context.options.put_call_ratio
            if pc >= 1.15:
                bearish_score += 1
            elif pc <= 0.75:
                bullish_score += 1
            if context.options.dvol_index is not None and context.options.dvol_index >= 55:
                bearish_score += 1

        if context.onchain:
            if context.onchain.activity_trend == "rising":
                bullish_score += 1
            elif context.onchain.activity_trend == "falling":
                bearish_score += 1
            hr_chg = context.onchain.hash_rate_change_7d_pct
            if hr_chg is not None:
                if hr_chg > 3:
                    bullish_score += 1
                elif hr_chg < -3:
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

        session_summary = (
            context.sessions.entry_hint.summary_ja
            if context.sessions and context.sessions.entry_hint
            else ""
        )
        if "控えめ" in session_summary and side != "neutral":
            confidence = round(confidence * 0.88, 2)

        entry_low, entry_high = self._entry_zone(price, side, ta, context)
        take_profit, stop_loss = self._exit_levels(price, side, ta, context)
        take_profit, stop_loss = clamp_exit_levels(price, side, take_profit, stop_loss)

        forecast_prices = [
            round(
                price
                * (
                    1
                    + 0.005
                    * (i + 1)
                    * (1 if macro_trend == "bullish" else -1 if macro_trend == "bearish" else 0)
                ),
                2,
            )
            for i in range(6)
        ]

        research_note = ""
        if context.research:
            research_note = f"登録調査メモ {len(context.research)} 件も方向判断に反映。"

        entry_rationale = (
            f"基準価格 {price:,.0f} 付近（{feat.reference_exchange}）。"
            f"スプレッド {spread_pct:.3f}%、{feat.orderbook_imbalance_detail}・"
            f"テクニカル・リスクゾーン・セッション時間帯を総合したエントリー帯です。{research_note}"
        )
        exit_rationale = (
            "想定抵抗/支持・清算帯推定・リスク許容幅から利確・損切り水準を設定しています。"
        )
        if context.risk_zones and (context.risk_zones.long_liquidation or context.risk_zones.short_squeeze):
            exit_rationale += "清算帯推定も参考にしています。"
        if context.etf_flows and context.etf_flows.trend != "neutral":
            exit_rationale += f"米国BTC ETFは{context.etf_flows.trend}傾向です。"
        if context.options:
            exit_rationale += f" Deribit Put/Call比は {context.options.put_call_ratio:.2f} です。"

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

    def _entry_zone(self, price: float, side: TradeSide, ta, context: ScenarioMarketContext) -> tuple[float, float]:
        if side == "long":
            entry_low = round(price * 0.995, 2)
            entry_high = round(price * 1.005, 2)
            if ta and ta.support:
                entry_low = round(min(entry_low, ta.support * 1.001), 2)
                entry_high = round(max(entry_high, min(ta.support * 1.008, price * 1.01)), 2)
            if context.heatmap and context.heatmap.strongest_bid_support_usd:
                support = context.heatmap.strongest_bid_support_usd
                if support < price and is_plausible_usd_price(support, price, min_ratio=0.85, max_ratio=1.0):
                    entry_low = round(min(entry_low, support * 1.002), 2)
        elif side == "short":
            entry_low = round(price * 0.995, 2)
            entry_high = round(price * 1.005, 2)
            if ta and ta.resistance:
                entry_high = round(min(entry_high, max(ta.resistance * 1.002, price * 1.005)), 2)
                entry_low = round(max(entry_low, ta.resistance * 0.992), 2)
            if context.heatmap and context.heatmap.strongest_ask_resistance_usd:
                resist = context.heatmap.strongest_ask_resistance_usd
                if resist > price and is_plausible_usd_price(resist, price, min_ratio=1.0, max_ratio=1.15):
                    entry_high = round(min(entry_high, resist * 1.002), 2)
        else:
            band = 0.005
            if ta and ta.support and ta.resistance:
                entry_low = round(ta.support, 2)
                entry_high = round(ta.resistance, 2)
            else:
                entry_low = round(price * (1 - band), 2)
                entry_high = round(price * (1 + band), 2)

        return entry_low, entry_high

    def _exit_levels(self, price: float, side: TradeSide, ta, context: ScenarioMarketContext) -> tuple[list[float], float]:
        if side == "long":
            take_profit = [round(price * 1.02, 2), round(price * 1.04, 2)]
            stop_loss = round(price * 0.97, 2)
            if ta and ta.resistance:
                take_profit[0] = round(min(take_profit[0], ta.resistance * 0.998), 2)
            if context.risk_zones and context.risk_zones.long_liquidation:
                liq_low = context.risk_zones.long_liquidation.zone_low
                if is_plausible_usd_price(liq_low, price, min_ratio=0.85, max_ratio=1.0):
                    stop_loss = round(min(stop_loss, liq_low * 0.995), 2)
        elif side == "short":
            take_profit = [round(price * 0.98, 2), round(price * 0.96, 2)]
            stop_loss = round(price * 1.03, 2)
            if ta and ta.support:
                take_profit[0] = round(max(take_profit[0], ta.support * 1.002), 2)
            if context.risk_zones and context.risk_zones.short_squeeze:
                sq_high = context.risk_zones.short_squeeze.zone_high
                if is_plausible_usd_price(sq_high, price, min_ratio=1.0, max_ratio=1.15):
                    stop_loss = round(max(stop_loss, sq_high * 1.005), 2)
        else:
            take_profit = [round(price * 1.01, 2)]
            stop_loss = round(price * 0.99, 2)

        return take_profit, stop_loss
