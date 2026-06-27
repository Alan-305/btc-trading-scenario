from datetime import datetime, timedelta, timezone

from app.schemas.candles import Candle
from app.services.prediction_evaluator import PredictionEvaluator, SavedPredictionInput


def _candle(ts: datetime, o: float, h: float, l: float, c: float) -> Candle:
    return Candle(ts=ts, open=o, high=h, low=l, close=c, volume=1.0)


def test_swing_tp_hit_scores_100():
    saved = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    now = saved + timedelta(days=3)
    candles = [
        _candle(saved + timedelta(hours=1), 100, 101, 99, 100),
        _candle(saved + timedelta(hours=2), 100, 106, 99, 105),
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
    # scale prices for test
    preds[0].reference_price = 100
    preds[0].entry_zone_low = 99
    preds[0].entry_zone_high = 101
    preds[0].take_profit = [105]
    preds[0].stop_loss = 97

    summary = PredictionEvaluator().evaluate_batch(preds, candles, now=now)
    ev = summary.evaluations[0]
    assert ev.swing_score_pct == 100.0
    assert ev.outcome == "win"
    assert ev.entry_zone_reached is True


def test_swing_sl_hit_scores_0():
    saved = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    now = saved + timedelta(days=2)
    candles = [
        _candle(saved + timedelta(hours=1), 100, 101, 96, 97),
    ]
    preds = [
        SavedPredictionInput(
            saved_at=saved.isoformat(),
            macro_trend="bullish",
            reference_price=100,
            entry_zone_low=99,
            entry_zone_high=101,
            take_profit=[110],
            stop_loss=97,
            side="long",
        )
    ]
    summary = PredictionEvaluator().evaluate_batch(preds, candles, now=now)
    assert summary.evaluations[0].swing_score_pct == 0.0
    assert summary.evaluations[0].stop_loss_hit is True


def test_swing_pending_within_7_days():
    saved = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    now = saved + timedelta(days=2)
    candles = [
        _candle(saved + timedelta(hours=1), 100, 101, 99.5, 100.5),
    ]
    preds = [
        SavedPredictionInput(
            saved_at=saved.isoformat(),
            macro_trend="bearish",
            reference_price=100,
            entry_zone_low=99,
            entry_zone_high=101,
            take_profit=[95],
            stop_loss=103,
            side="short",
        )
    ]
    summary = PredictionEvaluator().evaluate_batch(preds, candles, now=now)
    ev = summary.evaluations[0]
    assert ev.status == "pending"
    assert ev.swing_score_pct is None
    assert summary.pending_count == 1


def test_swing_direction_only_80_after_7_days():
    saved = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    now = saved + timedelta(days=7)
    candles = [
        _candle(saved + timedelta(hours=i), 100, 100.5, 99.5, 100 - i * 0.1)
        for i in range(1, 48)
    ]
    preds = [
        SavedPredictionInput(
            saved_at=saved.isoformat(),
            macro_trend="bearish",
            reference_price=100,
            entry_zone_low=99,
            entry_zone_high=101,
            take_profit=[90],
            stop_loss=105,
            side="short",
        )
    ]
    summary = PredictionEvaluator().evaluate_batch(preds, candles, now=now)
    ev = summary.evaluations[0]
    assert ev.status == "final"
    assert ev.swing_score_pct == 80.0
    assert ev.outcome == "partial"
