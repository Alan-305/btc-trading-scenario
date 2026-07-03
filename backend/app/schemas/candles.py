from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.market import OrderbookHeatmapCell


CandleInterval = Literal["1h", "4h", "1d", "1w"]


class Candle(BaseModel):
    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class CandlesResponse(BaseModel):
    symbol: str
    interval: CandleInterval
    candles: list[Candle]
    source: str = "binance"
    fetched_at: datetime | None = None


class MacdValues(BaseModel):
    macd: float
    signal: float
    histogram: float


class BollingerValues(BaseModel):
    upper: float
    middle: float
    lower: float


class OverlaySeriesPoint(BaseModel):
    ts: datetime
    ema_200: float | None = None
    bb_upper: float | None = None
    bb_middle: float | None = None
    bb_lower: float | None = None


class StochSeriesPoint(BaseModel):
    ts: datetime
    k: float
    d: float
    cross: Literal["gc", "dc"] | None = None


class IchimokuSeriesPoint(BaseModel):
    ts: datetime
    tenkan: float | None = None
    kijun: float | None = None
    senkou_a: float | None = None
    senkou_b: float | None = None


class TechnicalAnalysisResponse(BaseModel):
    symbol: str
    interval: CandleInterval
    rsi_14: float | None = None
    ema_20: float | None = None
    ema_50: float | None = None
    ema_200: float | None = None
    bollinger: BollingerValues | None = None
    macd: MacdValues | None = None
    support: float | None = None
    resistance: float | None = None
    atr_14: float | None = None
    adx_14: float | None = None
    stoch_k: float | None = None
    stoch_d: float | None = None
    stoch_last_cross: Literal["gc", "dc"] | None = None
    stoch_last_cross_ts: datetime | None = None
    stoch_zone: Literal["oversold", "overbought", "neutral"] | None = None
    stoch_signal_ja: str = ""
    stoch_summary_ja: str = ""
    stoch_stance: Literal["bullish", "bearish", "neutral", "reversal", "caution"] = "neutral"
    stoch_series: list[StochSeriesPoint] = Field(default_factory=list)
    ichimoku_tenkan: float | None = None
    ichimoku_kijun: float | None = None
    ichimoku_senkou_a: float | None = None
    ichimoku_senkou_b: float | None = None
    ichimoku_cloud_top: float | None = None
    ichimoku_cloud_bottom: float | None = None
    ichimoku_price_vs_cloud: Literal["above", "below", "inside"] | None = None
    ichimoku_signal: Literal["sanyaku_kouten", "sanyaku_gyakuten", "neutral"] | None = None
    ichimoku_signal_ja: str = ""
    ichimoku_summary_ja: str = ""
    ichimoku_stance: Literal["bullish", "bearish", "neutral", "reversal", "caution"] = "neutral"
    ichimoku_roles_met: int = 0
    ichimoku_series: list[IchimokuSeriesPoint] = Field(default_factory=list)
    trend: Literal["bullish", "bearish", "neutral"] = "neutral"
    summary_ja: str = ""
    overlay_series: list[OverlaySeriesPoint] = Field(default_factory=list)
    source: str = "binance"
    fetched_at: datetime | None = None


class RiskZone(BaseModel):
    zone_low: float
    zone_high: float
    label: str
    rationale: str
    confidence: float = Field(ge=0.0, le=1.0)


class OrderbookHeatmapResponse(BaseModel):
    cells: list[OrderbookHeatmapCell]
    exchange: str = "all"
    collected_at: datetime | None = None
    source: str = "exchanges"


class RiskZonesResponse(BaseModel):
    reference_price: float
    long_liquidation: RiskZone | None = None
    short_squeeze: RiskZone | None = None
    disclaimer: str = "推定値であり、実際の清算価格とは異なる場合があります。"
    source: str = "binance_okx"
    fetched_at: datetime | None = None


class PredictionEvaluation(BaseModel):
    saved_at: str | None = None
    predicted_trend: str
    reference_price: float
    current_price: float
    price_change_pct: float
    direction_correct: bool | None = None
    entry_zone_hit: bool | None = None
    entry_zone_reached: bool | None = None
    take_profit_hit: bool | None = None
    stop_loss_hit: bool | None = None
    outcome: Literal["win", "loss", "partial", "pending", "neutral"]
    status: Literal["pending", "final"] = "final"
    swing_score_pct: float | None = None
    days_remaining: int = 0
    trend_correct: bool | None = None


class AccuracySummary(BaseModel):
    total: int
    evaluated: int
    pending_count: int = 0
    finalized_count: int = 0
    direction_accuracy_pct: float | None = None
    entry_zone_reach_pct: float | None = None
    win_rate_pct: float | None = None
    evaluations: list[PredictionEvaluation]
