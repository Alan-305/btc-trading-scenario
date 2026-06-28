from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.scenario_context import ScenarioDataSources


MacroTrend = Literal["bullish", "bearish", "range"]
TradeSide = Literal["long", "short", "neutral"]
ScenarioHorizonId = Literal["today", "week", "month", "halving"]


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
    ta_trend: MacroTrend | None = None
    rsi_14: float | None = None


class ScenarioHorizonBundle(BaseModel):
    id: ScenarioHorizonId
    label: str
    period_hint: str
    entry: EntryZone
    exit: ExitStrategy
    forecast: list[ForecastPoint]
    scenario_text_ja: str


class ScenarioResponse(BaseModel):
    macro_trend: MacroTrend
    confidence: float = Field(ge=0.0, le=1.0)
    entry: EntryZone
    exit: ExitStrategy
    forecast: list[ForecastPoint]
    scenario_text_ja: str
    horizons: list[ScenarioHorizonBundle] = Field(default_factory=list)
    indicators: ScenarioIndicators
    data_sources: ScenarioDataSources | None = None
    generated_at: datetime
    disclaimer: str = "本情報は参考情報であり、投資助言ではありません。"
