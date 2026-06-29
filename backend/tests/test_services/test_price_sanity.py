from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.ml.inference import ScenarioInference
from app.schemas.candles import RiskZone, RiskZonesResponse
from app.schemas.market import FearGreedIndex, MarketSnapshot, NormalizedTicker, OrderbookHeatmapCell
from app.services.price_sanity import clamp_exit_levels, filter_usd_orderbooks, is_plausible_usd_price
from app.services.risk_zones import RiskZoneEstimator
from app.services.scenario_market_context import ScenarioMarketContext


def test_is_plausible_usd_price_rejects_jpy_scale():
    ref = 60_000.0
    assert is_plausible_usd_price(61_000, ref)
    assert not is_plausible_usd_price(9_600_000, ref)


def test_clamp_exit_levels_short_caps_runaway_stop():
    price = 60_000.0
    entry = 60_238.0
    tp, sl = clamp_exit_levels(entry, price, "short", [58_000, 57_000], 9_600_000)
    assert sl <= entry * 1.08
    assert sl > entry


def test_risk_zone_ignores_jpy_heatmap_resistance():
    ref = 60_000.0
    cells = [
        OrderbookHeatmapCell(price_bin=59_500, bid_depth=10, ask_depth=5),
        OrderbookHeatmapCell(price_bin=9_600_000, bid_depth=1, ask_depth=100),
    ]
    result = RiskZoneEstimator().estimate(ref, None, cells)
    assert result.short_squeeze is not None
    assert result.short_squeeze.zone_high < ref * 1.2


def test_inference_clamps_short_stop_with_jpy_squeeze_zone():
    inference = ScenarioInference()
    now = datetime.now(timezone.utc)
    snap = MarketSnapshot(
        tickers=[
            NormalizedTicker(
                exchange="whitebit",
                symbol="BTC_USDT",
                last_price=Decimal("60000"),
                timestamp=now,
            )
        ],
        orderbooks=[],
        collected_at=now,
    )
    ctx = ScenarioMarketContext(
        snapshot=snap,
        reference_price=60_000.0,
        fear_greed=FearGreedIndex(value=40, classification="Fear", timestamp=now),
        derivatives=None,
        technical=None,
        risk_zones=RiskZonesResponse(
            reference_price=60_000.0,
            short_squeeze=RiskZone(
                zone_low=62_000,
                zone_high=9_600_000,
                label="bad",
                rationale="test",
                confidence=0.5,
            ),
        ),
        sessions=None,
        heatmap=None,
        divergence_pct={},
        research=[],
    )
    signal = inference.predict(snap, ctx.fear_greed, None, ctx)
    assert signal.stop_loss < 70_000
