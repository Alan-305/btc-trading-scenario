from datetime import datetime, timedelta, timezone

import pytest
import numpy as np

from app.schemas.candles import Candle, MacdValues
from app.services.prediction_evaluator import PredictionEvaluator, SavedPredictionInput
from app.services.technical_analysis import (
    TechnicalAnalysisService,
    _adx,
    _combine_signals,
    _rsi,
)


def _make_candles(closes: list[float]) -> list[Candle]:
    from datetime import datetime, timedelta, timezone

    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    candles = []
    for i, close in enumerate(closes):
        candles.append(
            Candle(
                ts=base + timedelta(hours=i * 4),
                open=close * 0.999,
                high=close * 1.002,
                low=close * 0.998,
                close=close,
                volume=100.0,
            )
        )
    return candles


def test_rsi_bounds():
    closes = np.linspace(100, 120, 30)
    rsi = _rsi(closes, 14)
    assert rsi is not None
    assert 0 <= rsi <= 100


def test_rsi_wilder_extremes():
    # Monotonic up → no losses → RSI saturates at 100.
    up = np.linspace(100, 200, 40)
    assert _rsi(up, 14) == 100.0
    # Monotonic down → no gains → RSI collapses toward 0.
    down = np.linspace(200, 100, 40)
    assert _rsi(down, 14) == pytest.approx(0.0, abs=1e-6)


def test_rsi_wilder_matches_reference():
    # Canonical Wilder/StockCharts example: first RSI(14) from 15 closes ≈ 70.53
    # (seed = simple average of the first 14 changes, no smoothing step yet).
    closes = np.array(
        [
            44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42,
            45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28,
        ]
    )
    rsi = _rsi(closes, 14)
    assert rsi is not None
    assert rsi == pytest.approx(70.53, abs=0.2)


def _adx_candles(closes: list[float]) -> list[Candle]:
    return _make_candles(closes)


def test_adx_none_when_insufficient():
    assert _adx(_make_candles([100.0] * 10)) is None


def test_adx_higher_for_trend_than_chop():
    trend = _make_candles([100 + i for i in range(80)])
    chop = _make_candles([100 + (5 if i % 2 == 0 else -5) for i in range(80)])
    adx_trend = _adx(trend)
    adx_chop = _adx(chop)
    assert adx_trend is not None and adx_chop is not None
    assert 0 <= adx_chop <= 100 and 0 <= adx_trend <= 100
    # A clean one-directional move should register more trend strength than whipsaw.
    assert adx_trend > adx_chop


def test_combine_signals_strong_uptrend_is_bullish():
    trend, bull, bear = _combine_signals(
        price=110.0,
        rsi=58.0,
        ema20=105.0,
        ema50=100.0,
        ema200=95.0,
        macd=MacdValues(macd=1.0, signal=0.5, histogram=0.5),
        bollinger=None,
        adx=30.0,
        last_cross="gc",
        stoch_zone="neutral",
    )
    assert trend == "bullish"
    assert bull > bear


def test_combine_signals_range_favors_mean_reversion():
    # Weak downtrend structure but ranging (ADX<20) with oversold RSI + BB lower touch.
    from app.schemas.candles import BollingerValues

    trend, bull, bear = _combine_signals(
        price=90.0,
        rsi=25.0,
        ema20=100.0,
        ema50=102.0,
        ema200=105.0,
        macd=None,
        bollinger=BollingerValues(upper=110.0, middle=100.0, lower=90.0),
        adx=15.0,
        last_cross="gc",
        stoch_zone="oversold",
    )
    # In a range, oversold extremes should be faded (bullish), not chased down.
    assert trend == "bullish"
    assert bull > bear


def test_combine_signals_neutral_on_tie():
    trend, _bull, _bear = _combine_signals(
        price=100.0,
        rsi=50.0,
        ema20=None,
        ema50=None,
        ema200=None,
        macd=None,
        bollinger=None,
        adx=None,
        last_cross=None,
        stoch_zone="neutral",
    )
    assert trend == "neutral"


def test_technical_analysis_returns_summary():
    closes = [100 + i * 0.5 + (i % 3) for i in range(60)]
    candles = _make_candles(closes)
    result = TechnicalAnalysisService().analyze(candles, interval="4h")
    assert result.rsi_14 is not None
    assert result.bollinger is not None
    assert result.summary_ja
    assert result.trend in ("bullish", "bearish", "neutral")
    assert len(result.overlay_series) == 60


def test_technical_analysis_ema200_with_enough_candles():
    closes = [100000 + i * 10 for i in range(220)]
    candles = _make_candles(closes)
    result = TechnicalAnalysisService().analyze(candles, interval="4h")
    assert result.ema_200 is not None
    assert any(p.ema_200 is not None for p in result.overlay_series)


def test_technical_analysis_stochastic_with_enough_candles():
    closes = [100 + (i % 20) * 2 + (10 if i % 15 < 7 else -5) for i in range(80)]
    candles = _make_candles(closes)
    result = TechnicalAnalysisService().analyze(candles, interval="4h")
    assert result.stoch_k is not None
    assert result.stoch_d is not None
    assert result.stoch_zone in ("oversold", "overbought", "neutral")
    assert result.stoch_summary_ja
    assert len(result.stoch_series) > 0


def test_prediction_evaluator_direction():
    ev = PredictionEvaluator()
    saved = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    now = saved + timedelta(days=7)
    candles = [
        Candle(
            ts=saved + timedelta(hours=1),
            open=100000,
            high=102000,
            low=99000,
            close=102000,
            volume=1.0,
        )
    ]
    preds = [
        SavedPredictionInput(
            saved_at=saved.isoformat(),
            macro_trend="bullish",
            reference_price=100000,
            entry_zone_low=99000,
            entry_zone_high=101000,
            take_profit=[105000],
            stop_loss=97000,
            side="long",
        )
    ]
    summary = ev.evaluate_batch(preds, candles, now=now)
    assert summary.total == 1
    assert summary.evaluations[0].trend_correct is True
    assert summary.direction_accuracy_pct == 100.0


def test_ichimoku_sanyaku_kouten_on_uptrend():
    # 78+ bars for full ichimoku; steady uptrend should lean bullish
    closes = [50_000 + i * 120 for i in range(120)]
    candles = _make_candles(closes)
    svc = TechnicalAnalysisService()
    result = svc.analyze(candles, interval="1d")
    assert result.ichimoku_tenkan is not None
    assert result.ichimoku_kijun is not None
    assert result.ichimoku_summary_ja
    assert len(result.ichimoku_series) == len(candles)
