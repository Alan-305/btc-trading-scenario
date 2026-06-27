from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.schemas.candles import AccuracySummary, PredictionEvaluation


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
        current_price: float,
    ) -> AccuracySummary:
        evaluations: list[PredictionEvaluation] = []
        direction_hits = 0
        direction_total = 0
        wins = 0
        win_total = 0

        for pred in predictions:
            ev = self._evaluate_one(pred, current_price)
            evaluations.append(ev)

            if ev.direction_correct is not None:
                direction_total += 1
                if ev.direction_correct:
                    direction_hits += 1

            if ev.outcome in ("win", "loss", "partial"):
                win_total += 1
                if ev.outcome == "win":
                    wins += 1
                elif ev.outcome == "partial":
                    wins += 0.5

        return AccuracySummary(
            total=len(predictions),
            evaluated=len(evaluations),
            direction_accuracy_pct=(
                round(direction_hits / direction_total * 100, 1) if direction_total else None
            ),
            win_rate_pct=round(wins / win_total * 100, 1) if win_total else None,
            evaluations=evaluations,
        )

    def _evaluate_one(
        self,
        pred: SavedPredictionInput,
        current_price: float,
    ) -> PredictionEvaluation:
        ref = pred.reference_price
        change_pct = ((current_price - ref) / ref * 100) if ref > 0 else 0.0

        direction_correct: bool | None = None
        if pred.macro_trend == "bullish":
            direction_correct = current_price > ref
        elif pred.macro_trend == "bearish":
            direction_correct = current_price < ref

        entry_low = min(pred.entry_zone_low, pred.entry_zone_high)
        entry_high = max(pred.entry_zone_low, pred.entry_zone_high)
        entry_zone_hit = entry_low <= current_price <= entry_high

        take_profit_hit = any(
            (pred.side == "long" and current_price >= tp) or (pred.side == "short" and current_price <= tp)
            for tp in pred.take_profit
        )
        stop_loss_hit = (
            (pred.side == "long" and current_price <= pred.stop_loss)
            or (pred.side == "short" and current_price >= pred.stop_loss)
        )

        outcome: Literal["win", "loss", "partial", "pending", "neutral"]
        if pred.macro_trend == "range" or pred.side == "neutral":
            outcome = "neutral"
        elif take_profit_hit and not stop_loss_hit:
            outcome = "win"
        elif stop_loss_hit:
            outcome = "loss"
        elif direction_correct:
            outcome = "partial"
        else:
            outcome = "pending"

        return PredictionEvaluation(
            saved_at=pred.saved_at,
            predicted_trend=pred.macro_trend,
            reference_price=ref,
            current_price=current_price,
            price_change_pct=round(change_pct, 2),
            direction_correct=direction_correct,
            entry_zone_hit=entry_zone_hit,
            take_profit_hit=take_profit_hit,
            stop_loss_hit=stop_loss_hit,
            outcome=outcome,
        )
