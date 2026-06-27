from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


MacroTrend = Literal["bullish", "bearish", "range"]
TradeSide = Literal["long", "short", "neutral"]


class EntryZone(BaseModel):
    side: TradeSide
    zone_low: float
    zone_high: float
    rationale: str


class ExitStrategy(BaseModel):
    take_profit: list[float]
    stop_loss: float
    rationale: str


class ForecastPoint(BaseModel):
    ts: datetime
    price: float


class ScenarioIndicators(BaseModel):
    fear_greed: int | None = None
    funding_rate: float | None = None
    oi_change_24h_pct: float | None = None
    divergence_max_pct: float | None = None


class ScenarioResponse(BaseModel):
    macro_trend: MacroTrend
    confidence: float = Field(ge=0.0, le=1.0)
    entry: EntryZone
    exit: ExitStrategy
    forecast: list[ForecastPoint]
    scenario_text_ja: str
    indicators: ScenarioIndicators
    generated_at: datetime
    disclaimer: str = "本情報は参考情報であり、投資助言ではありません。"
