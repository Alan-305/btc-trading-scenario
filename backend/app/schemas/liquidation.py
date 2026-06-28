from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class LiquidationEvent(BaseModel):
    exchange: str
    symbol: str
    position_side: Literal["long", "short"]
    price: float
    notional_usd: float
    timestamp: datetime


class LiquidationClusters(BaseModel):
    long_zone_low: float | None = None
    long_zone_high: float | None = None
    long_notional_usd: float = 0.0
    long_event_count: int = 0
    short_zone_low: float | None = None
    short_zone_high: float | None = None
    short_notional_usd: float = 0.0
    short_event_count: int = 0
    source: str = "okx"
