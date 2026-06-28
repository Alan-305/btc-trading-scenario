from datetime import datetime, timezone

from app.schemas.liquidation import LiquidationEvent
from app.services.liquidation_clusters import build_liquidation_clusters
from app.services.risk_zones import RiskZoneEstimator


def _event(price: float, side: str, notional: float) -> LiquidationEvent:
    return LiquidationEvent(
        exchange="okx",
        symbol="BTC-USDT-SWAP",
        position_side=side,  # type: ignore[arg-type]
        price=price,
        notional_usd=notional,
        timestamp=datetime.now(timezone.utc),
    )


def test_clusters_find_long_liquidation_below_price():
    ref = 100_000.0
    events = [
        _event(98_400, "long", 400_000),
        _event(98_420, "long", 350_000),
        _event(98_380, "long", 300_000),
        _event(101_200, "short", 500_000),
    ]
    clusters = build_liquidation_clusters(events, ref, min_notional_usd=200_000)
    assert clusters is not None
    assert clusters.long_zone_low is not None
    assert clusters.long_zone_high < ref
    assert clusters.long_notional_usd >= 200_000


def test_risk_zones_merge_liquidation_history():
    ref = 100_000.0
    events = [
        _event(97_600, "long", 600_000),
        _event(97_620, "long", 550_000),
        _event(97_580, "long", 500_000),
    ]
    result = RiskZoneEstimator().estimate(ref, None, None, events)
    assert result.long_liquidation is not None
    assert "履歴" in result.long_liquidation.label
    assert result.long_liquidation.zone_low < 98_500


def test_long_sl_uses_history_liquidation_zone():
    from app.schemas.candles import RiskZone, RiskZonesResponse, TechnicalAnalysisResponse
    from app.services.trade_levels import compute_exit_levels
    from app.services.scenario_market_context import ScenarioMarketContext
    from app.schemas.market import MarketSnapshot, NormalizedTicker
    from decimal import Decimal

    now = datetime.now(timezone.utc)
    ctx = ScenarioMarketContext(
        snapshot=MarketSnapshot(
            tickers=[
                NormalizedTicker(
                    exchange="whitebit",
                    symbol="BTC_USDT",
                    last_price=Decimal("100000"),
                    timestamp=now,
                )
            ],
            orderbooks=[],
            collected_at=now,
        ),
        reference_price=100_000.0,
        fear_greed=None,
        derivatives=None,
        technical=TechnicalAnalysisResponse(symbol="BTCUSDT", interval="4h", atr_14=2000),
        risk_zones=RiskZonesResponse(
            reference_price=100_000.0,
            long_liquidation=RiskZone(
                zone_low=97_200,
                zone_high=97_600,
                label="Long清算帯（履歴）",
                rationale="test",
                confidence=0.8,
            ),
        ),
        sessions=None,
        heatmap=None,
        divergence_pct={},
    )
    _, sl = compute_exit_levels(100_000, "long", ctx.technical, ctx)
    assert sl <= 97_200 * 0.995 + 1
