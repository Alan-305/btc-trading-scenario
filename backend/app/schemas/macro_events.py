from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

MacroEventImpact = Literal["low", "medium", "high"]


class MacroEvent(BaseModel):
    event_id: str
    name: str
    name_ja: str | None = None
    country: str
    scheduled_at: datetime
    impact: MacroEventImpact
    estimate: str | None = None
    actual: str | None = None
    previous: str | None = None
    source: str = "finnhub"


class MacroEventsResponse(BaseModel):
    events: list[MacroEvent] = Field(default_factory=list)
    source: str = "finnhub"
    window_days: int = 7
    fetched_at: datetime | None = None
    note_ja: str | None = None
