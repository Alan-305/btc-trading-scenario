from app.schemas.candles import TechnicalAnalysisResponse
from app.schemas.mtf import MtfAnalysis, MtfTimeframeLayer
from app.services.multi_timeframe import build_mtf_analysis, evaluate_mtf_entry_gate


def _layer(interval: str, trend: str, **kwargs) -> MtfTimeframeLayer:
    labels = {"1w": "週足", "1d": "日足", "4h": "4時間足", "1h": "1時間足"}
    return MtfTimeframeLayer(
        interval=interval,  # type: ignore[arg-type]
        label_ja=labels[interval],
        trend=trend,  # type: ignore[arg-type]
        **kwargs,
    )


def test_long_entry_blocked_when_weekly_and_daily_bearish():
    analysis = MtfAnalysis(
        layers=[
            _layer("1w", "bearish"),
            _layer("1d", "bearish"),
            _layer("4h", "bullish"),
            _layer("1h", "bullish", stoch_last_cross="gc"),
        ]
    )
    gate = evaluate_mtf_entry_gate("long", 100_000, analysis)
    assert gate is not None
    assert gate.entry_blocked is True
    assert gate.entry_timing_ready is True


def test_long_htf_aligned_when_weekly_and_daily_bullish():
    analysis = MtfAnalysis(
        layers=[
            _layer("1w", "bullish"),
            _layer("1d", "bullish"),
            _layer("4h", "bullish"),
            _layer("1h", "range"),
        ]
    )
    gate = evaluate_mtf_entry_gate("long", 100_000, analysis)
    assert gate is not None
    assert gate.htf_aligned is True
    assert gate.entry_blocked is False


def test_short_near_weekly_support_barrier():
    analysis = MtfAnalysis(
        layers=[
            _layer("1w", "bearish", support=99_500),
            _layer("1d", "bearish"),
            _layer("4h", "bearish"),
            _layer("1h", "bearish", stoch_last_cross="dc"),
        ]
    )
    gate = evaluate_mtf_entry_gate("short", 99_600, analysis)
    assert gate is not None
    assert gate.near_htf_barrier is True


def test_build_mtf_analysis_from_ta_bundle():
    candles = [
        type("C", (), {"low": 90_000, "high": 110_000})()
        for _ in range(60)
    ]
    ta = TechnicalAnalysisResponse(
        symbol="BTCUSDT",
        interval="1d",
        trend="bullish",
        support=95_000,
        resistance=105_000,
    )
    result = build_mtf_analysis({"1d": (candles, ta)})
    assert len(result.layers) == 1
    assert result.layers[0].trend == "bullish"
