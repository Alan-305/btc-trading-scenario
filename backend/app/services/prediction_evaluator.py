from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel

from app.schemas.candles import AccuracySummary, Candle, PredictionEvaluation

EVALUATION_DAYS = 7
TREND_REVERSAL_PCT = 2.0


class SavedPredictionInput(BaseModel):
    saved_at: str | None = None
    macro_trend: Literal["bullish", "bearish", "range"]
    reference_price: float
    entry_zone_low: float
    entry_zone_high: float
    take_profit: list[float]
    stop_loss: float
    side: Literal["long", "short", "neutral"]


class PredictionEvaluator:
    def evaluate_batch(
        self,
        predictions: list[SavedPredictionInput],
        candles: list[Candle],
        now: datetime | None = None,
    ) -> AccuracySummary:
        now = now or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        sorted_candles = sorted(candles, key=lambda c: c.ts)
        evaluations: list[PredictionEvaluation] = []

        trend_hits = 0
        trend_total = 0
        entry_hits = 0
        entry_total = 0
        swing_scores: list[float] = []
        pending_count = 0
        finalized_count = 0

        for pred in predictions:
            ev = self._evaluate_one(pred, sorted_candles, now)
            evaluations.append(ev)

            if ev.status == "pending":
                pending_count += 1
                continue

            finalized_count += 1

            if ev.entry_zone_reached is not None:
                entry_total += 1
                if ev.entry_zone_reached:
                    entry_hits += 1

            if ev.trend_correct is not None:
                trend_total += 1
                if ev.trend_correct:
                    trend_hits += 1

            if ev.swing_score_pct is not None and ev.outcome != "neutral":
                swing_scores.append(ev.swing_score_pct)

        return AccuracySummary(
            total=len(predictions),
            evaluated=finalized_count,
            pending_count=pending_count,
            finalized_count=finalized_count,
            direction_accuracy_pct=(
                round(trend_hits / trend_total * 100, 1) if trend_total else None
            ),
            entry_zone_reach_pct=(
                round(entry_hits / entry_total * 100, 1) if entry_total else None
            ),
            win_rate_pct=(
                round(sum(swing_scores) / len(swing_scores), 1) if swing_scores else None
            ),
            evaluations=evaluations,
        )

    def _evaluate_one(
        self,
        pred: SavedPredictionInput,
        candles: list[Candle],
        now: datetime,
    ) -> PredictionEvaluation:
        ref = pred.reference_price
        saved_at = self._parse_saved_at(pred.saved_at)
        entry_low = min(pred.entry_zone_low, pred.entry_zone_high)
        entry_high = max(pred.entry_zone_low, pred.entry_zone_high)

        if saved_at is None:
            return self._neutral_evaluation(pred, ref, ref, "pending", None)

        window_end = min(saved_at + timedelta(days=EVALUATION_DAYS), now)
        is_pending = now < saved_at + timedelta(days=EVALUATION_DAYS)
        window_candles = [c for c in candles if saved_at <= c.ts <= window_end]

        if not window_candles:
            end_price = ref
        else:
            end_price = window_candles[-1].close

        change_pct = ((end_price - ref) / ref * 100) if ref > 0 else 0.0
        entry_zone_reached = self._entry_zone_hit(window_candles, entry_low, entry_high)

        if pred.macro_trend == "range" or pred.side == "neutral":
            return PredictionEvaluation(
                saved_at=pred.saved_at,
                predicted_trend=pred.macro_trend,
                reference_price=ref,
                current_price=round(end_price, 2),
                price_change_pct=round(change_pct, 2),
                direction_correct=None,
                entry_zone_hit=entry_zone_reached,
                entry_zone_reached=entry_zone_reached,
                take_profit_hit=False,
                stop_loss_hit=False,
                outcome="neutral",
                status="pending" if is_pending else "final",
                swing_score_pct=None,
                days_remaining=self._days_remaining(saved_at, now) if is_pending else 0,
                trend_correct=None,
            )

        tp_hit, sl_hit = self._scan_tp_sl(window_candles, pred)

        trend_correct = self._trend_correct(pred.macro_trend, ref, end_price)
        trend_reversed = self._trend_reversed(pred.macro_trend, ref, end_price)

        if is_pending and not tp_hit and not sl_hit:
            return PredictionEvaluation(
                saved_at=pred.saved_at,
                predicted_trend=pred.macro_trend,
                reference_price=ref,
                current_price=round(end_price, 2),
                price_change_pct=round(change_pct, 2),
                direction_correct=trend_correct,
                entry_zone_hit=entry_zone_reached,
                entry_zone_reached=entry_zone_reached,
                take_profit_hit=tp_hit,
                stop_loss_hit=sl_hit,
                outcome="pending",
                status="pending",
                swing_score_pct=None,
                days_remaining=self._days_remaining(saved_at, now),
                trend_correct=trend_correct,
            )

        outcome: Literal["win", "loss", "partial", "pending", "neutral"]
        swing_score: float

        if tp_hit and not sl_hit:
            outcome = "win"
            swing_score = 100.0
        elif sl_hit:
            outcome = "loss"
            swing_score = 0.0
        elif trend_reversed:
            outcome = "loss"
            swing_score = 0.0
        elif trend_correct:
            outcome = "partial"
            swing_score = 80.0
        else:
            outcome = "loss"
            swing_score = 0.0

        return PredictionEvaluation(
            saved_at=pred.saved_at,
            predicted_trend=pred.macro_trend,
            reference_price=ref,
            current_price=round(end_price, 2),
            price_change_pct=round(change_pct, 2),
            direction_correct=trend_correct,
            entry_zone_hit=entry_zone_reached,
            entry_zone_reached=entry_zone_reached,
            take_profit_hit=tp_hit,
            stop_loss_hit=sl_hit,
            outcome=outcome,
            status="final",
            swing_score_pct=swing_score,
            days_remaining=0,
            trend_correct=trend_correct,
        )

    @staticmethod
    def _parse_saved_at(raw: str | None) -> datetime | None:
        if not raw:
            return None
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    @staticmethod
    def _days_remaining(saved_at: datetime, now: datetime) -> int:
        end = saved_at + timedelta(days=EVALUATION_DAYS)
        if now >= end:
            return 0
        return max(0, (end.date() - now.date()).days)

    @staticmethod
    def _entry_zone_hit(candles: list[Candle], low: float, high: float) -> bool:
        for c in candles:
            if c.low <= high and c.high >= low:
                return True
        return False

    @staticmethod
    def _scan_tp_sl(
        candles: list[Candle],
        pred: SavedPredictionInput,
    ) -> tuple[bool, bool]:
        tp_hit = False
        sl_hit = False
        for c in candles:
            if pred.side == "long":
                if c.low <= pred.stop_loss:
                    sl_hit = True
                    break
                if any(c.high >= tp for tp in pred.take_profit):
                    tp_hit = True
                    break
            elif pred.side == "short":
                if c.high >= pred.stop_loss:
                    sl_hit = True
                    break
                if any(c.low <= tp for tp in pred.take_profit):
                    tp_hit = True
                    break
        return tp_hit, sl_hit

    @staticmethod
    def _trend_correct(trend: str, ref: float, end: float) -> bool:
        if trend == "bullish":
            return end > ref
        if trend == "bearish":
            return end < ref
        return False

    @staticmethod
    def _trend_reversed(trend: str, ref: float, end: float) -> bool:
        if ref <= 0:
            return False
        change = (end - ref) / ref * 100
        if trend == "bullish":
            return change <= -TREND_REVERSAL_PCT
        if trend == "bearish":
            return change >= TREND_REVERSAL_PCT
        return False

    @staticmethod
    def _neutral_evaluation(
        pred: SavedPredictionInput,
        ref: float,
        end: float,
        status: Literal["pending", "final"],
        days_remaining: int | None,
    ) -> PredictionEvaluation:
        change_pct = ((end - ref) / ref * 100) if ref > 0 else 0.0
        return PredictionEvaluation(
            saved_at=pred.saved_at,
            predicted_trend=pred.macro_trend,
            reference_price=ref,
            current_price=round(end, 2),
            price_change_pct=round(change_pct, 2),
            direction_correct=None,
            entry_zone_hit=False,
            entry_zone_reached=False,
            take_profit_hit=False,
            stop_loss_hit=False,
            outcome="neutral",
            status=status,
            swing_score_pct=None,
            days_remaining=days_remaining or 0,
            trend_correct=None,
        )
