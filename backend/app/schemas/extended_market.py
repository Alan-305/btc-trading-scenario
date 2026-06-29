from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

MacroStance = Literal["bullish", "bearish", "neutral", "reversal", "caution"]


class MacroSeriesPoint(BaseModel):
    ts: datetime
    value: float


class BtcOptionsSnapshot(BaseModel):
    put_open_interest: float
    call_open_interest: float
    put_call_ratio: float
    dvol_index: float | None = None
    dvol_history: list[MacroSeriesPoint] = Field(default_factory=list)
    instrument_count: int = 0
    stance: MacroStance = "neutral"
    signal_ja: str = "様子見"
    summary_ja: str = ""
    source: str = "deribit"
    timestamp: datetime | None = None


class BtcEtfFlowSnapshot(BaseModel):
    net_flow_1d_usd: float | None = None
    net_flow_3d_usd: float | None = None
    trend: Literal["inflow", "outflow", "neutral"] = "neutral"
    daily_flows: list[MacroSeriesPoint] = Field(default_factory=list)
    tickers_tracked: list[str] = Field(default_factory=list)
    stance: MacroStance = "neutral"
    signal_ja: str = "様子見"
    summary_ja: str = ""
    source: str = "yahoo_proxy"
    timestamp: datetime | None = None


class OnChainSnapshot(BaseModel):
    hash_rate_th_s: float | None = None
    hash_rate_change_7d_pct: float | None = None
    tx_count_24h: float | None = None
    trade_volume_usd: float | None = None
    mempool_fast_fee_sat: int | None = None
    activity_trend: Literal["rising", "falling", "stable"] = "stable"
    hash_rate_history: list[MacroSeriesPoint] = Field(default_factory=list)
    tx_count_history: list[MacroSeriesPoint] = Field(default_factory=list)
    stance: MacroStance = "neutral"
    signal_ja: str = "様子見"
    summary_ja: str = ""
    source: str = "blockchain.info"
    timestamp: datetime | None = None


class UsdtDominanceSnapshot(BaseModel):
    dominance_pct: float
    change_7d_pct: float | None = None
    trend: Literal["rising", "falling", "stable"] = "stable"
    history: list[MacroSeriesPoint] = Field(default_factory=list)
    stance: MacroStance = "neutral"
    signal_ja: str = "様子見"
    summary_ja: str = ""
    source: str = "coingecko"
    timestamp: datetime | None = None


class MacroContextSnapshot(BaseModel):
    options: BtcOptionsSnapshot | None = None
    etf_flows: BtcEtfFlowSnapshot | None = None
    onchain: OnChainSnapshot | None = None
    usdt_dominance: UsdtDominanceSnapshot | None = None
    overall_stance: MacroStance = "neutral"
    overall_signal_ja: str = "様子見"
    overall_summary_ja: str = ""
