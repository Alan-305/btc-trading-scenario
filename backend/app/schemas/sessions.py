from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SessionStatus = Literal["active", "upcoming", "closed"]
ActivityLevel = Literal["low", "medium", "high", "peak"]


class ClockDisplay(BaseModel):
    timezone: str
    label_ja: str
    datetime_iso: str
    time_hm: str
    weekday_ja: str


class ExchangeSessionRole(BaseModel):
    exchange: str
    name_ja: str
    primary_session_id: str
    note_ja: str


class MarketSessionBlock(BaseModel):
    id: str
    name_ja: str
    centers_ja: str
    utc_start_hm: str
    utc_end_hm: str
    jst_start_hm: str
    jst_end_hm: str
    status: SessionStatus
    activity_level: ActivityLevel
    overlap_with: list[str] = Field(default_factory=list)
    linked_exchanges: list[str] = Field(default_factory=list)


class TimelineHour(BaseModel):
    jst_hour: int
    jst_label: str
    activity_level: ActivityLevel
    active_sessions: list[str]
    is_now: bool
    good_for_whitebit: bool
    good_for_bitbank: bool


class EntryTimingHint(BaseModel):
    summary_ja: str
    detail_ja: str
    next_high_activity_jst: str | None = None


class MarketSessionsResponse(BaseModel):
    clocks: list[ClockDisplay]
    sessions: list[MarketSessionBlock]
    timeline_jst: list[TimelineHour]
    exchanges: list[ExchangeSessionRole]
    entry_hint: EntryTimingHint
    generated_at: datetime
