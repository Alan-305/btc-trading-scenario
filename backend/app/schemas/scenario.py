from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.mtf import MtfAnalysis, MtfEntryGate
from app.schemas.scenario_context import ScenarioDataSources


MacroTrend = Literal["bullish", "bearish", "range"]
TradeSide = Literal["long", "short", "neutral"]
ScenarioHorizonId = Literal["today", "week", "hodl"]
HorizonMode = Literal["swing", "hodl"]


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
    put_call_ratio: float | None = None
    dvol_index: float | None = None
    etf_flow_3d_usd: float | None = None
    etf_trend: str | None = None
    onchain_activity_trend: str | None = None
    usdt_dominance_pct: float | None = None
    usdt_dominance_change_7d_pct: float | None = None
    usdt_dominance_trend: str | None = None
    stoch_k: float | None = None
    stoch_d: float | None = None
    stoch_last_cross: str | None = None
    mtf_summary_ja: str | None = None
    mtf_htf_aligned: bool | None = None
    mtf_entry_blocked: bool | None = None
    mtf_entry_timing_ready: bool | None = None
    mtf_near_htf_barrier: bool | None = None


class HoldBuyZone(BaseModel):
    label: str
    zone_low: float
    zone_high: float
    rationale: str


class CyclePeakTarget(BaseModel):
    cycle_label: str
    peak_window: str
    price_low: float
    price_high: float
    note_ja: str


class HoldScenarioContext(BaseModel):
    cycle_phase_ja: str
    days_since_halving: int
    days_to_next_halving: int
    last_halving_label: str
    next_halving_label: str
    cycle_window_note_ja: str
    buy_zones: list[HoldBuyZone] = Field(default_factory=list)
    peak_targets: list[CyclePeakTarget] = Field(default_factory=list)
    research_notes: list[str] = Field(default_factory=list)


class ScenarioHorizonBundle(BaseModel):
    id: ScenarioHorizonId
    label: str
    period_hint: str
    horizon_mode: HorizonMode = "swing"
    hold_context: HoldScenarioContext | None = None
    entry: EntryZone
    exit: ExitStrategy
    forecast: list[ForecastPoint]
    scenario_text_ja: str


class DirectionalScenario(BaseModel):
    macro_trend: Literal["bullish", "bearish"]
    confidence: float = Field(ge=0.0, le=1.0)
    entry: EntryZone
    exit: ExitStrategy
    forecast: list[ForecastPoint]
    scenario_text_ja: str
    horizons: list[ScenarioHorizonBundle] = Field(default_factory=list)


class WatchScenario(BaseModel):
    confidence: float = Field(ge=0.0, le=1.0)
    range_low: float
    range_high: float
    support: float | None = None
    resistance: float | None = None
    scenario_text_ja: str
    rationale: str


class ScenarioResponse(BaseModel):
    macro_trend: MacroTrend
    confidence: float = Field(ge=0.0, le=1.0)
    entry: EntryZone
    exit: ExitStrategy
    forecast: list[ForecastPoint]
    scenario_text_ja: str
    horizons: list[ScenarioHorizonBundle] = Field(default_factory=list)
    bullish: DirectionalScenario | None = None
    bearish: DirectionalScenario | None = None
    watch: WatchScenario | None = None
    indicators: ScenarioIndicators
    mtf: MtfAnalysis | None = None
    mtf_gates: list[MtfEntryGate] = Field(default_factory=list)
    data_sources: ScenarioDataSources | None = None
    generated_at: datetime
    disclaimer: str = "本情報は参考情報であり、投資助言ではありません。"
