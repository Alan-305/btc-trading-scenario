from __future__ import annotations

from dataclasses import dataclass

from app.ml.features import FeatureEngine
from app.schemas.market import CoinglassSnapshot, FearGreedIndex, MarketSnapshot
from app.schemas.scenario import MacroTrend, TradeSide
from app.services.scenario_market_context import ScenarioMarketContext
from app.services.multi_timeframe import evaluate_mtf_entry_gate, layer_by_interval
from app.services.trade_levels import compute_entry_zone, compute_trade_exits, resolve_atr_pct


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


@dataclass
class WatchInference:
    confidence: float
    range_low: float
    range_high: float
    support: float | None
    resistance: float | None
    rationale: str


@dataclass
class ScenarioBranches:
    bullish: InferenceSignal
    bearish: InferenceSignal
    watch: WatchInference
    primary_trend: MacroTrend
    bullish_score: int
    bearish_score: int


class ScenarioInference:
    """Rule-based signal engine using full dashboard market context + user research."""

    WATCH_SCORE_DIFF_THRESHOLD = 2

    def __init__(self):
        self.features = FeatureEngine()

    def predict(
        self,
        snapshot: MarketSnapshot,
        fear_greed: FearGreedIndex | None,
        coinglass: CoinglassSnapshot | None,
        context: ScenarioMarketContext,
    ) -> InferenceSignal:
        branches = self.predict_branches(snapshot, fear_greed, coinglass, context)
        if branches.primary_trend == "bullish":
            return branches.bullish
        if branches.primary_trend == "bearish":
            return branches.bearish
        return self._neutral_primary_signal(branches, context)

    def predict_branches(
        self,
        snapshot: MarketSnapshot,
        fear_greed: FearGreedIndex | None,
        coinglass: CoinglassSnapshot | None,
        context: ScenarioMarketContext,
    ) -> ScenarioBranches:
        feat = self.features.extract(snapshot, fear_greed, coinglass)
        bullish_score, bearish_score = self._score_market(feat, coinglass, context)

        bullish = self._build_directional_signal(
            "bullish",
            "long",
            bullish_score,
            bearish_score,
            feat,
            context,
        )
        bearish = self._build_directional_signal(
            "bearish",
            "short",
            bearish_score,
            bullish_score,
            feat,
            context,
        )
        watch = self._build_watch_signal(
            bullish_score,
            bearish_score,
            feat.reference_price,
            context,
        )
        primary_trend = self._pick_primary_trend(bullish_score, bearish_score)

        return ScenarioBranches(
            bullish=bullish,
            bearish=bearish,
            watch=watch,
            primary_trend=primary_trend,
            bullish_score=bullish_score,
            bearish_score=bearish_score,
        )

    def _score_market(
        self,
        feat,
        coinglass: CoinglassSnapshot | None,
        context: ScenarioMarketContext,
    ) -> tuple[int, int]:
        bullish_score = 0
        bearish_score = 0
        fg = feat.fear_greed or 50
        funding = feat.funding_rate or 0.0
        ta = context.technical
        price = feat.reference_price

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

        if context.usdt_dominance:
            trend = context.usdt_dominance.trend
            if trend == "rising":
                bearish_score += 2
            elif trend == "falling":
                bullish_score += 2
            change = context.usdt_dominance.change_7d_pct
            if change is not None:
                if change >= 0.5:
                    bearish_score += 1
                elif change <= -0.5:
                    bullish_score += 1

        if context.equity_markets:
            stance = context.equity_markets.stance
            if stance == "bullish":
                bullish_score += 2
            elif stance == "bearish":
                bearish_score += 2
            elif stance == "caution":
                bearish_score += 1
            elif stance == "reversal":
                bullish_score += 1

        if ta and ta.stoch_last_cross == "gc":
            if ta.stoch_zone == "oversold":
                bullish_score += 2
            elif ta.stoch_zone != "overbought":
                bullish_score += 1
        elif ta and ta.stoch_last_cross == "dc":
            if ta.stoch_zone == "overbought":
                bearish_score += 2
            elif ta.stoch_zone != "oversold":
                bearish_score += 1
        elif ta and ta.stoch_zone == "oversold":
            bullish_score += 1
        elif ta and ta.stoch_zone == "overbought":
            bearish_score += 1

        if context.mtf:
            layers = layer_by_interval(context.mtf)
            weekly = layers.get("1w")
            daily = layers.get("1d")
            hourly = layers.get("1h")
            if weekly:
                if weekly.trend == "bullish":
                    bullish_score += 2
                elif weekly.trend == "bearish":
                    bearish_score += 2
            if daily:
                if daily.trend == "bullish":
                    bullish_score += 1
                elif daily.trend == "bearish":
                    bearish_score += 1
            if hourly:
                if hourly.stoch_last_cross == "gc":
                    bullish_score += 1
                elif hourly.stoch_last_cross == "dc":
                    bearish_score += 1

        return bullish_score, bearish_score

    def _pick_primary_trend(self, bullish_score: int, bearish_score: int) -> MacroTrend:
        diff = abs(bullish_score - bearish_score)
        if diff <= self.WATCH_SCORE_DIFF_THRESHOLD:
            return "range"
        if bullish_score > bearish_score:
            return "bullish"
        return "bearish"

    def _directional_confidence(self, own_score: int, other_score: int) -> float:
        total = own_score + other_score + 1
        confidence = round(own_score / total, 2)
        return max(0.35, min(0.85, confidence))

    def _build_directional_signal(
        self,
        macro_trend: MacroTrend,
        side: TradeSide,
        own_score: int,
        other_score: int,
        feat,
        context: ScenarioMarketContext,
    ) -> InferenceSignal:
        price = feat.reference_price
        ta = context.technical
        confidence = self._directional_confidence(own_score, other_score)

        session_summary = (
            context.sessions.entry_hint.summary_ja
            if context.sessions and context.sessions.entry_hint
            else ""
        )
        if "控えめ" in session_summary:
            confidence = round(confidence * 0.88, 2)

        entry_low, entry_high = compute_entry_zone(
            price, side, ta, context.heatmap, confidence=confidence, mtf=context.mtf
        )
        take_profit, stop_loss = compute_trade_exits(
            entry_low, entry_high, price, side, ta, context, mtf=context.mtf
        )

        gate = evaluate_mtf_entry_gate(side, price, context.mtf)
        if gate:
            if gate.entry_blocked:
                confidence = round(confidence * 0.82, 2)
            elif gate.htf_aligned:
                confidence = round(min(0.85, confidence * 1.08), 2)
            if gate.near_htf_barrier:
                confidence = round(confidence * 0.9, 2)

        direction = 1 if macro_trend == "bullish" else -1
        forecast_prices = [
            round(price * (1 + 0.005 * (i + 1) * direction), 2) for i in range(6)
        ]

        research_note = ""
        if context.research:
            research_note = f"登録調査メモ {len(context.research)} 件も方向判断に反映。"

        mtf_note = ""
        if gate:
            mtf_note = f" {gate.gate_summary_ja}"
            if gate.caution_ja:
                mtf_note += gate.caution_ja

        trend_ja = "上昇" if macro_trend == "bullish" else "下降"
        entry_rationale = (
            f"【{trend_ja}シナリオ】基準価格 {price:,.0f} 付近（{feat.reference_exchange}）。"
            f"スプレッド {feat.spread_pct:.3f}%、{feat.orderbook_imbalance_detail}・"
            f"MTF（週足→日足→4H→1H）・板クラスターを前提にした"
            f"{('ロング' if side == 'long' else 'ショート')}向けエントリー帯です。{research_note}{mtf_note}"
        )
        exit_rationale = self._exit_rationale(price, ta, context)

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

    def _build_watch_signal(
        self,
        bullish_score: int,
        bearish_score: int,
        price: float,
        context: ScenarioMarketContext,
    ) -> WatchInference:
        ta = context.technical
        range_low, range_high = compute_entry_zone(
            price, "neutral", ta, context.heatmap, confidence=0.5
        )
        support = round(ta.support, 2) if ta and ta.support else range_low
        resistance = round(ta.resistance, 2) if ta and ta.resistance else range_high

        diff = abs(bullish_score - bearish_score)
        total = max(1, bullish_score + bearish_score)
        closeness = 1 - min(1.0, diff / (total + 1))
        confidence = round(max(0.4, min(0.88, 0.45 + closeness * 0.4)), 2)

        if diff <= 2:
            stance = "拮抗"
            action = "新規エントリーを見送り、ブレイクを待ちましょう"
        elif bearish_score > bullish_score:
            stance = "下降材料優勢"
            action = "下落シナリオのエントリー帯まで戻りを待ちましょう"
        else:
            stance = "上昇材料優勢"
            action = "上昇シナリオのエントリー帯まで押し目を待ちましょう"

        rationale = (
            f"上昇材料スコア {bullish_score}・下降材料スコア {bearish_score}（{stance}）。"
            f"レンジ ${min(range_low, range_high):,.0f}〜${max(range_low, range_high):,.0f} では{action}。"
            f"上抜け・下抜けで各シナリオを検討してください。"
        )

        return WatchInference(
            confidence=confidence,
            range_low=min(range_low, range_high, support),
            range_high=max(range_low, range_high, resistance),
            support=support,
            resistance=resistance,
            rationale=rationale,
        )

    def _neutral_primary_signal(
        self, branches: ScenarioBranches, context: ScenarioMarketContext
    ) -> InferenceSignal:
        watch = branches.watch
        price = context.reference_price
        forecast_prices = [round(price, 2) for _ in range(6)]
        return InferenceSignal(
            macro_trend="range",
            confidence=watch.confidence,
            side="neutral",
            entry_low=watch.range_low,
            entry_high=watch.range_high,
            take_profit=[],
            stop_loss=watch.support or watch.range_low,
            forecast_prices=forecast_prices,
            entry_rationale=watch.rationale,
            exit_rationale="様子見モードのため、明確な利確・損切りラインは設定していません。",
        )

    def _exit_rationale(self, price: float, ta, context: ScenarioMarketContext) -> str:
        atr_pct = resolve_atr_pct(price, ta)
        exit_rationale = (
            f"ATR(14) {atr_pct * 100:.1f}% 相当のボラティリティ・板クラスター・"
            "想定抵抗/支持・清算帯推定から利確・損切り水準を設定しています。"
        )
        if context.risk_zones and (
            context.risk_zones.long_liquidation or context.risk_zones.short_squeeze
        ):
            exit_rationale += "清算帯推定も参考にしています。"
            if (
                context.risk_zones.long_liquidation
                and "履歴" in context.risk_zones.long_liquidation.label
            ):
                exit_rationale += " OKX直近清算履歴を反映しています。"
            if (
                context.risk_zones.short_squeeze
                and "履歴" in context.risk_zones.short_squeeze.label
            ):
                exit_rationale += " OKX直近清算履歴を反映しています。"
        if context.etf_flows and context.etf_flows.trend != "neutral":
            exit_rationale += f"米国BTC ETFは{context.etf_flows.trend}傾向です。"
        if context.options:
            exit_rationale += f" Deribit Put/Call比は {context.options.put_call_ratio:.2f} です。"
        if context.usdt_dominance:
            u = context.usdt_dominance
            exit_rationale += (
                f" USDTドミナンスは {u.dominance_pct:.2f}%（{u.trend}）で、"
                f"{'BTC逆風' if u.trend == 'rising' else 'BTC追い風' if u.trend == 'falling' else '中立'}材料です。"
            )
        if context.equity_markets and context.equity_markets.summary_ja:
            exit_rationale += f" {context.equity_markets.summary_ja}"
        if ta and ta.stoch_k is not None and ta.stoch_d is not None:
            cross = ""
            if ta.stoch_last_cross == "gc":
                cross = "・直近GC"
            elif ta.stoch_last_cross == "dc":
                cross = "・直近DC"
            exit_rationale += f" ストキャス %K {ta.stoch_k:.0f}/%D {ta.stoch_d:.0f}{cross} をタイミング参考にしています。"
        return exit_rationale
