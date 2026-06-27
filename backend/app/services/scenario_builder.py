from __future__ import annotations

from datetime import datetime, timedelta, timezone
from app.integrations.alternative_me import AlternativeMeClient
from app.integrations.derivatives_provider import DerivativesProvider
from app.ml.inference import ScenarioInference
from app.llm.scenario_writer import ScenarioWriter
from app.schemas.market import MarketSnapshot
from app.schemas.scenario import (
    EntryZone,
    ExitStrategy,
    ForecastPoint,
    ScenarioIndicators,
    ScenarioResponse,
)
from app.services.divergence import DivergenceService
from app.services.market_aggregator import MarketAggregator
from app.services.scenario_context import reference_price_from_snapshot


class ScenarioBuilder:
    def __init__(
        self,
        aggregator: MarketAggregator,
        divergence: DivergenceService,
        inference: ScenarioInference,
        writer: ScenarioWriter,
        fear_greed: AlternativeMeClient,
        coinglass: DerivativesProvider,
    ):
        self.aggregator = aggregator
        self.divergence = divergence
        self.inference = inference
        self.writer = writer
        self.fear_greed = fear_greed
        self.coinglass = coinglass

    async def build(self) -> ScenarioResponse:
        snapshot = await self.aggregator.collect_all()
        snapshot = self.divergence.apply(snapshot)

        fg = await self.fear_greed.fetch_fear_greed()
        cg = await self.coinglass.fetch_snapshot()

        signal = self.inference.predict(snapshot, fg, cg)
        now = datetime.now(timezone.utc)

        forecast = [
            ForecastPoint(ts=now + timedelta(hours=h), price=p)
            for h, p in enumerate(signal.forecast_prices, start=1)
        ]

        indicators = ScenarioIndicators(
            fear_greed=fg.value if fg else None,
            funding_rate=cg.funding_rate if cg else None,
            oi_change_24h_pct=None,
            divergence_max_pct=DivergenceService.max_divergence_pct(snapshot.divergence_pct),
        )

        scenario_text = await self.writer.generate(
            macro_trend=signal.macro_trend,
            confidence=signal.confidence,
            side=signal.side,
            reference_price=reference_price_from_snapshot(snapshot),
            entry_low=signal.entry_low,
            entry_high=signal.entry_high,
            take_profit=signal.take_profit,
            stop_loss=signal.stop_loss,
            fear_greed=fg.value if fg else None,
            funding_rate=cg.funding_rate if cg else None,
            divergence_max_pct=indicators.divergence_max_pct,
        )

        return ScenarioResponse(
            macro_trend=signal.macro_trend,
            confidence=signal.confidence,
            entry=EntryZone(
                side=signal.side,
                zone_low=signal.entry_low,
                zone_high=signal.entry_high,
                rationale=signal.entry_rationale,
            ),
            exit=ExitStrategy(
                take_profit=signal.take_profit,
                stop_loss=signal.stop_loss,
                rationale=signal.exit_rationale,
            ),
            forecast=forecast,
            scenario_text_ja=scenario_text,
            indicators=indicators,
            generated_at=now,
        )

    async def build_from_snapshot(self, snapshot: MarketSnapshot) -> ScenarioResponse:
        snapshot = self.divergence.apply(snapshot)
        fg = await self.fear_greed.fetch_fear_greed()
        cg = await self.coinglass.fetch_snapshot()
        signal = self.inference.predict(snapshot, fg, cg)
        now = datetime.now(timezone.utc)
        forecast = [
            ForecastPoint(ts=now + timedelta(hours=h), price=p)
            for h, p in enumerate(signal.forecast_prices, start=1)
        ]
        indicators = ScenarioIndicators(
            fear_greed=fg.value if fg else None,
            funding_rate=cg.funding_rate if cg else None,
            divergence_max_pct=DivergenceService.max_divergence_pct(snapshot.divergence_pct),
        )
        scenario_text = await self.writer.generate(
            macro_trend=signal.macro_trend,
            confidence=signal.confidence,
            side=signal.side,
            reference_price=reference_price_from_snapshot(snapshot),
            entry_low=signal.entry_low,
            entry_high=signal.entry_high,
            take_profit=signal.take_profit,
            stop_loss=signal.stop_loss,
            fear_greed=fg.value if fg else None,
            funding_rate=cg.funding_rate if cg else None,
            divergence_max_pct=indicators.divergence_max_pct,
        )
        return ScenarioResponse(
            macro_trend=signal.macro_trend,
            confidence=signal.confidence,
            entry=EntryZone(
                side=signal.side,
                zone_low=signal.entry_low,
                zone_high=signal.entry_high,
                rationale=signal.entry_rationale,
            ),
            exit=ExitStrategy(
                take_profit=signal.take_profit,
                stop_loss=signal.stop_loss,
                rationale=signal.exit_rationale,
            ),
            forecast=forecast,
            scenario_text_ja=scenario_text,
            indicators=indicators,
            generated_at=now,
        )
