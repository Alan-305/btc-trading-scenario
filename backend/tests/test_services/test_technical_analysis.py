import pytest
import numpy as np

from app.schemas.candles import Candle
from app.services.prediction_evaluator import PredictionEvaluator, SavedPredictionInput
from app.services.technical_analysis import TechnicalAnalysisService, _rsi


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


def test_prediction_evaluator_direction():
    ev = PredictionEvaluator()
    preds = [
        SavedPredictionInput(
            saved_at="2026-01-01T00:00:00Z",
            macro_trend="bullish",
            reference_price=100000,
            entry_zone_low=99000,
            entry_zone_high=101000,
            take_profit=[105000],
            stop_loss=97000,
            side="long",
        )
    ]
    summary = ev.evaluate_batch(preds, current_price=102000)
    assert summary.total == 1
    assert summary.evaluations[0].direction_correct is True
    assert summary.direction_accuracy_pct == 100.0
