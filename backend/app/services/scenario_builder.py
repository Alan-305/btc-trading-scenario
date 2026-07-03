from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from app.collectors.http_client import CollectorHttpClient
from app.integrations.finnhub_calendar import MacroEventsService
from app.integrations.binance_klines import BinanceKlinesClient
from app.integrations.btc_etf_flows import BtcEtfFlowClient
from app.integrations.usdt_dominance import UsdtDominanceClient
from app.integrations.deribit_options import DeribitOptionsClient
from app.integrations.equity_indices import EquityIndicesClient
from app.integrations.derivatives_provider import DerivativesProvider
from app.integrations.onchain_metrics import OnChainMetricsClient
from app.llm.scenario_writer import ScenarioWriter
from app.ml.inference import InferenceSignal, ScenarioBranches, ScenarioInference, WatchInference
from app.schemas.market import MarketSnapshot
from app.schemas.scenario import (
    DirectionalScenario,
    EntryZone,
    ExitStrategy,
    ForecastPoint,
    ScenarioIndicators,
    ScenarioResponse,
    WatchScenario,
)
from app.schemas.scenario_context import ResearchContextItem, ScenarioDataSources
from app.schemas.mtf import MtfEntryGate
from app.services.divergence import DivergenceService
from app.services.market_aggregator import MarketAggregator
from app.services.market_sessions import MarketSessionsService
from app.services.liquidation_feed import LiquidationFeed
from app.services.risk_zones import RiskZoneEstimator
from app.services.scenario_context import reference_price_from_snapshot
from app.services.scenario_horizons import build_scenario_horizons
from app.services.scenario_market_context import ScenarioMarketContext, summarize_heatmap
from app.services.macro_analysis import enrich_equity_markets, enrich_usdt_dominance
from app.services.multi_timeframe import build_mtf_analysis, evaluate_mtf_entry_gate
from app.services.technical_analysis import TechnicalAnalysisService
from app.services.volume_profile import OrderbookHeatmapService


class ScenarioBuilder:
    def __init__(
        self,
        aggregator: MarketAggregator,
        divergence: DivergenceService,
        inference: ScenarioInference,
        writer: ScenarioWriter,
        fear_greed: AlternativeMeClient,
        coinglass: DerivativesProvider,
        klines: BinanceKlinesClient | None = None,
        technical: TechnicalAnalysisService | None = None,
        heatmap: OrderbookHeatmapService | None = None,
        risk_zones: RiskZoneEstimator | None = None,
        liquidation_feed: LiquidationFeed | None = None,
        sessions: MarketSessionsService | None = None,
        deribit_options: DeribitOptionsClient | None = None,
        etf_flows: BtcEtfFlowClient | None = None,
        onchain: OnChainMetricsClient | None = None,
        usdt_dominance: UsdtDominanceClient | None = None,
        equity_indices: EquityIndicesClient | None = None,
        http: CollectorHttpClient | None = None,
    ):
        self.aggregator = aggregator
        self.divergence = divergence
        self.inference = inference
        self.writer = writer
        self.fear_greed = fear_greed
        self.coinglass = coinglass
        self.klines = klines
        self.technical = technical or TechnicalAnalysisService()
        self.heatmap = heatmap or OrderbookHeatmapService()
        self.risk_zones = risk_zones or RiskZoneEstimator()
        self.liquidation_feed = liquidation_feed
        self.sessions = sessions or MarketSessionsService()
        self.deribit_options = deribit_options
        self.etf_flows = etf_flows
        self.onchain = onchain
        self.usdt_dominance = usdt_dominance
        self.equity_indices = equity_indices
        self.http = http

    async def _fetch_macro_events(self):
        if not self.http:
            return []
        try:
            resp = await MacroEventsService(self.http).fetch(days=7)
            return resp.events
        except Exception:
            return []

    async def _collect_market_context(
        self,
        snapshot: MarketSnapshot,
        research: list[ResearchContextItem] | None = None,
    ) -> ScenarioMarketContext:
        ref_price = reference_price_from_snapshot(snapshot)
        fg = await self.fear_greed.fetch_fear_greed()
        cg = await self.coinglass.fetch_snapshot()

        technical = None
        daily_technical = None
        mtf = None
        if self.klines:
            try:
                intervals = ("1w", "1d", "4h", "1h")
                limits = {"1w": 250, "1d": 250, "4h": 250, "1h": 250}
                candle_results = await asyncio.gather(
                    *[self.klines.fetch(interval=iv, limit=limits[iv]) for iv in intervals],
                    return_exceptions=True,
                )
                analyses: dict = {}
                for iv, result in zip(intervals, candle_results, strict=True):
                    if isinstance(result, Exception) or not result:
                        continue
                    analyses[iv] = (result, self.technical.analyze(result, interval=iv))
                if "4h" in analyses:
                    technical = analyses["4h"][1]
                daily_technical = analyses["1d"][1] if "1d" in analyses else None
                if analyses:
                    mtf = build_mtf_analysis(analyses)
            except Exception:
                technical = None
                daily_technical = None
                mtf = None

        heatmap_cells = self.heatmap.compute(snapshot.orderbooks, reference_price=ref_price)
        heatmap_summary = summarize_heatmap(heatmap_cells, ref_price)
        liq_events = []
        if self.liquidation_feed:
            liq_events = await self.liquidation_feed.fetch_recent()
        risk = self.risk_zones.estimate(ref_price, cg, heatmap_cells, liq_events)
        session_data = self.sessions.build()

        options = await self.deribit_options.fetch_snapshot() if self.deribit_options else None
        etf = await self.etf_flows.fetch_snapshot() if self.etf_flows else None
        onchain = await self.onchain.fetch_snapshot() if self.onchain else None
        usdt_raw = await self.usdt_dominance.fetch_snapshot() if self.usdt_dominance else None
        usdt = enrich_usdt_dominance(usdt_raw) if usdt_raw else None
        equity_raw = await self.equity_indices.fetch_snapshot() if self.equity_indices else None
        equity = enrich_equity_markets(equity_raw) if equity_raw else None

        return ScenarioMarketContext(
            snapshot=snapshot,
            reference_price=ref_price,
            fear_greed=fg,
            derivatives=cg,
            technical=technical,
            risk_zones=risk,
            sessions=session_data,
            heatmap=heatmap_summary,
            divergence_pct=dict(snapshot.divergence_pct),
            options=options,
            etf_flows=etf,
            onchain=onchain,
            usdt_dominance=usdt,
            equity_markets=equity,
            research=research or [],
            mtf=mtf,
            daily_technical=daily_technical,
        )

    async def _build_directional(
        self,
        signal: InferenceSignal,
        context: ScenarioMarketContext,
        now: datetime,
    ) -> DirectionalScenario:
        forecast = [
            ForecastPoint(ts=now + timedelta(hours=h), price=p)
            for h, p in enumerate(signal.forecast_prices, start=1)
        ]

        entry = EntryZone(
            side=signal.side,
            zone_low=signal.entry_low,
            zone_high=signal.entry_high,
            rationale=signal.entry_rationale,
        )
        exit = ExitStrategy(
            take_profit=signal.take_profit,
            stop_loss=signal.stop_loss,
            rationale=signal.exit_rationale,
        )

        scenario_text = await self.writer.generate(
            macro_trend=signal.macro_trend,
            confidence=signal.confidence,
            side=signal.side,
            reference_price=context.reference_price,
            entry_low=signal.entry_low,
            entry_high=signal.entry_high,
            take_profit=signal.take_profit,
            stop_loss=signal.stop_loss,
            market_context=context,
        )

        session_summary = (
            context.sessions.entry_hint.summary_ja
            if context.sessions and context.sessions.entry_hint
            else None
        )
        macro_events = await self._fetch_macro_events()
        research_notes = [
            item.title.strip()
            for item in context.research
            if getattr(item, "title", None) and str(item.title).strip()
        ][:5]
        support = context.technical.support if context.technical else None

        horizons = build_scenario_horizons(
            price=context.reference_price,
            macro_trend=signal.macro_trend,
            side=signal.side,
            base_entry_rationale=signal.entry_rationale,
            base_exit_rationale=signal.exit_rationale,
            now=now,
            today_scenario_text=scenario_text,
            today_entry=entry,
            today_exit=exit,
            today_forecast=forecast,
            research_count=len(context.research),
            session_summary=session_summary,
            macro_events=macro_events,
            support=support,
            research_notes=research_notes or None,
        )

        return DirectionalScenario(
            macro_trend=signal.macro_trend,  # type: ignore[arg-type]
            confidence=signal.confidence,
            entry=entry,
            exit=exit,
            forecast=forecast,
            scenario_text_ja=scenario_text,
            horizons=horizons,
        )

    def _build_watch_bundle(
        self,
        watch: WatchInference,
        branches: ScenarioBranches,
        context: ScenarioMarketContext,
    ) -> WatchScenario:
        low = watch.range_low
        high = watch.range_high
        support = watch.support or low
        resistance = watch.resistance or high
        research_note = (
            f" 登録調査メモ {len(context.research)} 件も参考にしています。"
            if context.research
            else ""
        )
        diff = abs(branches.bullish_score - branches.bearish_score)
        if diff <= 2:
            lead = (
                f"いまは材料が拮抗しており（上昇 {branches.bullish_score}・下降 {branches.bearish_score}）、"
                f"新規エントリーは見送りが無難です。"
            )
        elif branches.bearish_score > branches.bullish_score:
            lead = (
                f"下降材料が優勢です（上昇 {branches.bullish_score}・下降 {branches.bearish_score}）。"
                f"いまはすぐに飛び乗らず、下落シナリオのエントリー帯を待ちましょう。"
            )
        else:
            lead = (
                f"上昇材料が優勢です（上昇 {branches.bullish_score}・下降 {branches.bearish_score}）。"
                f"いまはすぐに飛び乗らず、上昇シナリオのエントリー帯を待ちましょう。"
            )
        scenario_text = (
            f"{lead}"
            f" {low:,.0f}ドル〜{high:,.0f}ドルのレンジ内では様子見し、"
            f" {resistance:,.0f}ドルを上抜ければ上昇シナリオ、"
            f" {support:,.0f}ドルを下抜ければ下落シナリオを検討してください。"
            f"{research_note}"
        )
        return WatchScenario(
            confidence=watch.confidence,
            range_low=low,
            range_high=high,
            support=support,
            resistance=resistance,
            scenario_text_ja=scenario_text,
            rationale=watch.rationale,
        )

    def _build_indicators(
        self,
        context: ScenarioMarketContext,
        *,
        primary_side: str = "neutral",
        primary_price: float = 0.0,
    ) -> ScenarioIndicators:
        ta_trend = context.technical.trend if context.technical else None
        if ta_trend == "neutral":
            ta_trend = "range"

        gate = evaluate_mtf_entry_gate(primary_side, primary_price, context.mtf)  # type: ignore[arg-type]

        return ScenarioIndicators(
            fear_greed=context.fear_greed.value if context.fear_greed else None,
            funding_rate=context.derivatives.funding_rate if context.derivatives else None,
            oi_change_24h_pct=None,
            divergence_max_pct=DivergenceService.max_divergence_pct(context.divergence_pct),
            ta_trend=ta_trend,  # type: ignore[arg-type]
            rsi_14=context.technical.rsi_14 if context.technical else None,
            put_call_ratio=context.options.put_call_ratio if context.options else None,
            dvol_index=context.options.dvol_index if context.options else None,
            etf_flow_3d_usd=context.etf_flows.net_flow_3d_usd if context.etf_flows else None,
            etf_trend=context.etf_flows.trend if context.etf_flows else None,
            onchain_activity_trend=context.onchain.activity_trend if context.onchain else None,
            usdt_dominance_pct=context.usdt_dominance.dominance_pct if context.usdt_dominance else None,
            usdt_dominance_change_7d_pct=(
                context.usdt_dominance.change_7d_pct if context.usdt_dominance else None
            ),
            usdt_dominance_trend=context.usdt_dominance.trend if context.usdt_dominance else None,
            stoch_k=context.technical.stoch_k if context.technical else None,
            stoch_d=context.technical.stoch_d if context.technical else None,
            stoch_last_cross=context.technical.stoch_last_cross if context.technical else None,
            ichimoku_signal=(
                context.daily_technical.ichimoku_signal if context.daily_technical else None
            ),
            ichimoku_signal_ja=(
                context.daily_technical.ichimoku_signal_ja if context.daily_technical else None
            ),
            ichimoku_stance=(
                context.daily_technical.ichimoku_stance if context.daily_technical else None
            ),
            ichimoku_summary_ja=(
                context.daily_technical.ichimoku_summary_ja if context.daily_technical else None
            ),
            long_short_ratio=(
                context.derivatives.long_short_ratio if context.derivatives else None
            ),
            long_short_position_ratio=(
                context.derivatives.long_short_position_ratio if context.derivatives else None
            ),
            top_trader_long_short_ratio=(
                context.derivatives.top_trader_long_short_ratio if context.derivatives else None
            ),
            long_short_ratio_change_24h=(
                context.derivatives.long_short_ratio_change_24h if context.derivatives else None
            ),
            long_short_signal=(
                context.derivatives.long_short_signal if context.derivatives else None
            ),
            long_short_signal_ja=(
                context.derivatives.long_short_signal_ja if context.derivatives else None
            ),
            long_short_stance=(
                context.derivatives.long_short_stance if context.derivatives else None
            ),
            long_short_summary_ja=(
                context.derivatives.long_short_summary_ja if context.derivatives else None
            ),
            mtf_summary_ja=context.mtf.summary_ja if context.mtf else None,
            mtf_htf_aligned=gate.htf_aligned if gate else None,
            mtf_entry_blocked=gate.entry_blocked if gate else None,
            mtf_entry_timing_ready=gate.entry_timing_ready if gate else None,
            mtf_near_htf_barrier=gate.near_htf_barrier if gate else None,
        )

    def _build_mtf_gates(self, context: ScenarioMarketContext) -> list[MtfEntryGate]:
        gates: list[MtfEntryGate] = []
        price = context.reference_price
        if not context.mtf or price <= 0:
            return gates
        for side in ("long", "short"):
            gate = evaluate_mtf_entry_gate(side, price, context.mtf)  # type: ignore[arg-type]
            if gate:
                gates.append(gate)
        return gates

    def _build_data_sources(self, context: ScenarioMarketContext) -> ScenarioDataSources:
        return ScenarioDataSources(
            research_items_used=len(context.research),
            includes_technical=context.technical is not None,
            includes_risk_zones=context.risk_zones is not None,
            includes_sessions=context.sessions is not None,
            includes_heatmap=context.heatmap is not None,
            includes_derivatives=context.derivatives is not None,
            includes_options=context.options is not None,
            includes_etf_flows=context.etf_flows is not None,
            includes_onchain=context.onchain is not None,
            includes_usdt_dominance=context.usdt_dominance is not None,
            includes_equity_markets=context.equity_markets is not None,
            includes_mtf=context.mtf is not None,
            personalized=len(context.research) > 0,
        )

    async def _assemble(
        self,
        branches: ScenarioBranches,
        context: ScenarioMarketContext,
    ) -> ScenarioResponse:
        now = datetime.now(timezone.utc)

        bullish_bundle, bearish_bundle = await asyncio.gather(
            self._build_directional(branches.bullish, context, now),
            self._build_directional(branches.bearish, context, now),
        )
        watch_bundle = self._build_watch_bundle(branches.watch, branches, context)

        primary = branches.primary_trend
        if primary == "bullish":
            primary_bundle = bullish_bundle
        elif primary == "bearish":
            primary_bundle = bearish_bundle
        else:
            primary_bundle = None

        if primary_bundle:
            macro_trend = primary
            confidence = primary_bundle.confidence
            entry = primary_bundle.entry
            exit = primary_bundle.exit
            forecast = primary_bundle.forecast
            scenario_text = primary_bundle.scenario_text_ja
            horizons = primary_bundle.horizons
        else:
            macro_trend = "range"
            confidence = watch_bundle.confidence
            entry = EntryZone(
                side="neutral",
                zone_low=watch_bundle.range_low,
                zone_high=watch_bundle.range_high,
                rationale=watch_bundle.rationale,
            )
            exit = ExitStrategy(
                take_profit=[watch_bundle.resistance] if watch_bundle.resistance else [],
                stop_loss=watch_bundle.support or watch_bundle.range_low,
                rationale="様子見モード。レンジ下限を損切り目安、上限をブレイク監視の参考にしています。",
            )
            forecast = [
                ForecastPoint(ts=now + timedelta(hours=h), price=round(context.reference_price, 2))
                for h in range(1, 7)
            ]
            scenario_text = watch_bundle.scenario_text_ja
            horizons = []

        return ScenarioResponse(
            macro_trend=macro_trend,
            confidence=confidence,
            entry=entry,
            exit=exit,
            forecast=forecast,
            scenario_text_ja=scenario_text,
            horizons=horizons,
            bullish=bullish_bundle,
            bearish=bearish_bundle,
            watch=watch_bundle,
            indicators=self._build_indicators(
                context,
                primary_side=entry.side,
                primary_price=context.reference_price,
            ),
            mtf=context.mtf,
            mtf_gates=self._build_mtf_gates(context),
            data_sources=self._build_data_sources(context),
            generated_at=now,
        )

    async def build(self, research: list[ResearchContextItem] | None = None) -> ScenarioResponse:
        snapshot = await self.aggregator.collect_all(include_orderbooks=True)
        snapshot = self.divergence.apply(snapshot)
        context = await self._collect_market_context(snapshot, research)
        branches = self.inference.predict_branches(
            snapshot,
            context.fear_greed,
            context.derivatives,
            context,
        )
        return await self._assemble(branches, context)

    async def build_from_snapshot(
        self,
        snapshot: MarketSnapshot,
        research: list[ResearchContextItem] | None = None,
    ) -> ScenarioResponse:
        snapshot = self.divergence.apply(snapshot)
        if not snapshot.orderbooks:
            enriched = await self.aggregator.collect_all(include_orderbooks=True)
            snapshot.orderbooks = enriched.orderbooks
        context = await self._collect_market_context(snapshot, research)
        branches = self.inference.predict_branches(
            snapshot,
            context.fear_greed,
            context.derivatives,
            context,
        )
        return await self._assemble(branches, context)
