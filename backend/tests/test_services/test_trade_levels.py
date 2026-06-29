from datetime import datetime, timezone
from decimal import Decimal

from app.schemas.candles import RiskZone, RiskZonesResponse, TechnicalAnalysisResponse
from app.schemas.market import MarketSnapshot, NormalizedTicker, OrderbookHeatmapCell
from app.services.scenario_market_context import HeatmapSummary, ScenarioMarketContext, summarize_heatmap
from app.services.trade_levels import MIN_RR, MAX_SL_ATR_MULT, compute_entry_zone, compute_trade_exits, entry_reference, resolve_atr_pct, reward_risk_ratio


def _ta(atr: float | None = 2000.0, support: float | None = 98_000, resistance: float | None = 102_000):
    return TechnicalAnalysisResponse(
        symbol="BTCUSDT",
        interval="4h",
        atr_14=atr,
        support=support,
        resistance=resistance,
        trend="bullish",
    )


def _context(heatmap: HeatmapSummary | None = None, **kwargs) -> ScenarioMarketContext:
    now = datetime.now(timezone.utc)
    snap = MarketSnapshot(
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
    )
    base = dict(
        snapshot=snap,
        reference_price=100_000.0,
        fear_greed=None,
        derivatives=None,
        technical=_ta(),
        risk_zones=None,
        sessions=None,
        heatmap=heatmap,
        divergence_pct={},
    )
    base.update(kwargs)
    return ScenarioMarketContext(**base)


def test_resolve_atr_pct_from_ta():
    assert resolve_atr_pct(100_000, _ta(atr=2_500)) == 0.025


def test_summarize_heatmap_returns_multiple_bid_clusters():
    cells = [
        OrderbookHeatmapCell(price_bin=99_000, bid_depth=50, ask_depth=5),
        OrderbookHeatmapCell(price_bin=98_500, bid_depth=120, ask_depth=4),
        OrderbookHeatmapCell(price_bin=97_800, bid_depth=80, ask_depth=3),
        OrderbookHeatmapCell(price_bin=101_500, bid_depth=4, ask_depth=90),
        OrderbookHeatmapCell(price_bin=102_200, bid_depth=3, ask_depth=60),
    ]
    summary = summarize_heatmap(cells, 100_000)
    assert summary is not None
    assert len(summary.bid_support_levels) >= 2
    assert len(summary.ask_resistance_levels) >= 1
    assert summary.strongest_bid_support_usd == summary.bid_support_levels[0]


def test_long_exit_enforces_min_rr_from_entry():
    ctx = _context()
    low, high = compute_entry_zone(100_000, "long", ctx.technical, None, confidence=0.7)
    entry_ref = entry_reference(low, high, 100_000)
    tp, sl = compute_trade_exits(low, high, 100_000, "long", ctx.technical, ctx)
    rr = reward_risk_ratio(entry_ref, "long", tp, sl)
    assert rr is not None
    assert rr >= MIN_RR - 0.01
    assert sl < entry_ref
    assert tp[0] > entry_ref


def test_long_entry_uses_bid_cluster():
    heatmap = HeatmapSummary(
        strongest_bid_support_usd=99_200,
        bid_support_levels=[99_200, 98_600],
        ask_resistance_levels=[101_800],
    )
    low, high = compute_entry_zone(100_000, "long", _ta(), heatmap, confidence=0.7)
    assert low <= 99_400
    assert high <= 100_800


def test_short_entry_ignores_distant_resistance():
    """Regression: 4H swing high far above spot must not stretch the short entry band."""
    spot = 60_247.0
    low, high = compute_entry_zone(
        spot,
        "short",
        _ta(atr=1_500, support=58_000, resistance=81_000),
        None,
        confidence=0.7,
    )
    assert high <= spot * 1.02
    assert low >= spot * 0.98
    assert high - low <= spot * 0.04


def test_short_exit_enforces_min_rr_despite_near_support():
    """Regression: nearby support must not collapse TP while SL stays wide."""
    ctx = _context(
        heatmap=HeatmapSummary(
            bid_support_levels=[59_747, 58_504],
            ask_resistance_levels=[60_900],
        ),
        technical=_ta(atr=1_500, support=59_747, resistance=60_925),
    )
    spot = 60_000.0
    low, high = compute_entry_zone(spot, "short", ctx.technical, ctx.heatmap, confidence=0.7)
    entry_ref = entry_reference(low, high, spot)
    tp, sl = compute_trade_exits(low, high, spot, "short", ctx.technical, ctx)
    rr = reward_risk_ratio(entry_ref, "short", tp, sl)
    assert rr is not None
    assert rr >= MIN_RR - 0.01
    assert sl <= entry_ref + spot * 0.025 * 2.05
    assert entry_ref - tp[0] >= (sl - entry_ref) * MIN_RR - 5


def test_short_exit_caps_liquidation_stop_within_max_risk():
    ctx = _context(
        risk_zones=RiskZonesResponse(
            reference_price=60_000.0,
            short_squeeze=RiskZone(
                zone_low=62_000,
                zone_high=63_175,
                label="squeeze",
                rationale="test",
                confidence=0.7,
            ),
        ),
        technical=_ta(atr=1_500, support=58_388, resistance=60_925),
    )
    spot = 60_000.0
    low, high = compute_entry_zone(spot, "short", ctx.technical, None, confidence=0.7)
    entry_ref = entry_reference(low, high, spot)
    tp, sl = compute_trade_exits(low, high, spot, "short", ctx.technical, ctx)
    max_sl = entry_ref + spot * resolve_atr_pct(spot, ctx.technical) * MAX_SL_ATR_MULT
    assert sl <= max_sl + spot * 0.001
    rr = reward_risk_ratio(entry_ref, "short", tp, sl)
    assert rr is not None
    assert rr >= MIN_RR - 0.01
