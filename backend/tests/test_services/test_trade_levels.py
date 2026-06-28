from datetime import datetime, timezone
from decimal import Decimal

from app.schemas.candles import TechnicalAnalysisResponse
from app.schemas.market import MarketSnapshot, NormalizedTicker, OrderbookHeatmapCell
from app.services.scenario_market_context import HeatmapSummary, ScenarioMarketContext, summarize_heatmap
from app.services.trade_levels import compute_entry_zone, compute_exit_levels, resolve_atr_pct


def _ta(atr: float | None = 2000.0, support: float | None = 98_000, resistance: float | None = 102_000):
    return TechnicalAnalysisResponse(
        symbol="BTCUSDT",
        interval="4h",
        atr_14=atr,
        support=support,
        resistance=resistance,
        trend="bullish",
    )


def _context(heatmap: HeatmapSummary | None = None) -> ScenarioMarketContext:
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
    return ScenarioMarketContext(
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


def test_long_exit_uses_atr_not_fixed_three_percent():
    ctx = _context()
    tp, sl = compute_exit_levels(100_000, "long", ctx.technical, ctx)
    assert sl > 97_000
    assert sl < 99_500
    assert tp[0] > 100_500
    assert tp[0] - 100_000 >= (100_000 - sl) * 1.5 - 1


def test_long_entry_uses_bid_cluster():
    heatmap = HeatmapSummary(
        strongest_bid_support_usd=99_200,
        bid_support_levels=[99_200, 98_600],
        ask_resistance_levels=[101_800],
    )
    low, high = compute_entry_zone(100_000, "long", _ta(), heatmap, confidence=0.7)
    assert low <= 99_400
    assert high <= 100_800


def test_long_tp_capped_near_ask_cluster():
    heatmap = HeatmapSummary(
        ask_resistance_levels=[100_800, 101_500],
        bid_support_levels=[99_000],
    )
    ctx = _context(heatmap)
    tp, _ = compute_exit_levels(100_000, "long", _ta(atr=800), ctx)
    assert tp[0] <= 100_800 * 0.998 + 1
