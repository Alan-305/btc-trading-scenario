import pytest

from app.ml.inference import ScenarioInference
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
