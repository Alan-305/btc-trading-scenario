from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

MtfInterval = Literal["1w", "1d", "4h", "1h"]
MtfTrend = Literal["bullish", "bearish", "range"]
MtfTradeSide = Literal["long", "short", "neutral"]


class MtfTimeframeLayer(BaseModel):
    interval: MtfInterval
    label_ja: str
    trend: MtfTrend
    support: float | None = None
    resistance: float | None = None
    stoch_last_cross: Literal["gc", "dc"] | None = None
    stoch_zone: Literal["oversold", "overbought", "neutral"] | None = None
    summary_ja: str = ""


class MtfEntryGate(BaseModel):
    side: MtfTradeSide
    htf_aligned: bool = False
    entry_blocked: bool = False
    entry_timing_ready: bool = False
    near_htf_barrier: bool = False
    gate_summary_ja: str = ""
    caution_ja: str | None = None


class MtfAnalysis(BaseModel):
    layers: list[MtfTimeframeLayer] = Field(default_factory=list)
    summary_ja: str = ""
