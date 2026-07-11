import pytest

from app.ml.inference import ScenarioInference
from app.schemas.candles import TechnicalAnalysisResponse
from app.schemas.extended_market import UsdtDominanceSnapshot
from app.schemas.market import FearGreedIndex, MarketSnapshot
from app.schemas.scenario_context import ResearchContextItem
from app.services.scenario_market_context import ScenarioMarketContext
from datetime import datetime, timezone
from decimal import Decimal

from app.schemas.market import NormalizedTicker


def _ticker(price: float) -> NormalizedTicker:
    now = datetime.now(timezone.utc)
    return NormalizedTicker(
        exchange="whitebit",
        symbol="BTC_USDT",
        last_price=Decimal(str(price)),
        bid=Decimal(str(price * 0.999)),
        ask=Decimal(str(price * 1.001)),
        timestamp=now,
    )


def _context(research=None, **kwargs) -> ScenarioMarketContext:
    snap = MarketSnapshot(
        tickers=[_ticker(100_000)],
        orderbooks=[],
        collected_at=datetime.now(timezone.utc),
    )
    base = dict(
        snapshot=snap,
        reference_price=100_000.0,
        fear_greed=FearGreedIndex(value=60, classification="Greed", timestamp=datetime.now(timezone.utc)),
        derivatives=None,
        technical=None,
        risk_zones=None,
        sessions=None,
        heatmap=None,
        divergence_pct={},
        research=research or [],
    )
    base.update(kwargs)
    return ScenarioMarketContext(**base)


def test_research_bullish_context_biases_long():
    inference = ScenarioInference()
    signal = inference.predict(
        _context().snapshot,
        _context().fear_greed,
        None,
        _context(
            research=[
                ResearchContextItem(
                    title="ETF",
                    summary_line="ETF流入が続く",
                    market_context="bullish",
                )
            ]
        ),
    )
    assert signal.side in ("long", "neutral")


def test_research_bearish_context_biases_short():
    inference = ScenarioInference()
    ctx = _context(
        research=[
            ResearchContextItem(
                title="規制",
                summary_line="規制強化の懸念",
                market_context="bearish",
            )
        ]
    )
    signal = inference.predict(ctx.snapshot, ctx.fear_greed, None, ctx)
    assert signal.macro_trend in ("bearish", "range", "bullish")
    branches = inference.predict_branches(ctx.snapshot, ctx.fear_greed, None, ctx)
    assert branches.bearish.confidence >= branches.bullish.confidence or branches.primary_trend == "range"


def test_predict_branches_returns_bullish_and_bearish():
    inference = ScenarioInference()
    ctx = _context()
    branches = inference.predict_branches(ctx.snapshot, ctx.fear_greed, None, ctx)
    assert branches.bullish.side == "long"
    assert branches.bearish.side == "short"
    assert branches.bullish.macro_trend == "bullish"
    assert branches.bearish.macro_trend == "bearish"
    assert branches.watch.range_low > 0
    assert branches.watch.range_high > branches.watch.range_low


def test_pick_primary_requires_clear_lead():
    inference = ScenarioInference()
    assert inference._pick_primary_trend(10, 9) == "range"
    assert inference._pick_primary_trend(12, 10) == "range"  # diff 2
    assert inference._pick_primary_trend(14, 10) == "range"  # diff 4 < 5
    # diff 6, ratio 1.5, winner >= 8
    assert inference._pick_primary_trend(15, 9) == "bullish"
    assert inference._pick_primary_trend(9, 15) == "bearish"
    # thin winner score
    assert inference._pick_primary_trend(7, 1) == "range"


def test_pick_primary_defers_when_weekly_conflicts():
    from app.schemas.mtf import MtfAnalysis, MtfTimeframeLayer

    inference = ScenarioInference()
    mtf = MtfAnalysis(
        layers=[
            MtfTimeframeLayer(
                interval="1w",
                label_ja="週足",
                trend="bearish",
                support=None,
                resistance=None,
                summary_ja="下降",
            )
        ],
        summary_ja="週足下降",
    )
    ctx = _context(mtf=mtf)
    assert inference._pick_primary_trend(16, 8, ctx) == "range"
    assert inference._pick_primary_trend(8, 16, ctx) == "bearish"


def test_usdt_rising_biases_bearish():
    inference = ScenarioInference()
    ctx = _context(
        usdt_dominance=UsdtDominanceSnapshot(
            dominance_pct=6.1,
            change_7d_pct=0.7,
            trend="rising",
        )
    )
    branches = inference.predict_branches(ctx.snapshot, ctx.fear_greed, None, ctx)
    assert branches.bearish_score > branches.bullish_score


def test_stoch_gc_oversold_biases_bullish():
    inference = ScenarioInference()
    ctx = _context(
        technical=TechnicalAnalysisResponse(
            symbol="BTCUSDT",
            interval="4h",
            stoch_k=18.0,
            stoch_d=15.0,
            stoch_last_cross="gc",
            stoch_zone="oversold",
            stoch_signal_ja="反発寄り",
        )
    )
    branches = inference.predict_branches(ctx.snapshot, ctx.fear_greed, None, ctx)
    assert branches.bullish_score >= branches.bearish_score
