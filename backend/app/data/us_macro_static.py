"""Curated US macro events when Finnhub API key is not configured."""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.schemas.macro_events import MacroEvent

ET = ZoneInfo("America/New_York")

# FOMC statement release ~14:00 ET (decision days)
FOMC_DECISION_2026: tuple[tuple[str, str], ...] = (
    ("2026-01-28", "FOMC 政策金利発表"),
    ("2026-03-18", "FOMC 政策金利発表"),
    ("2026-04-29", "FOMC 政策金利発表"),
    ("2026-06-17", "FOMC 政策金利発表"),
    ("2026-07-29", "FOMC 政策金利発表"),
    ("2026-09-16", "FOMC 政策金利発表"),
    ("2026-10-28", "FOMC 政策金利発表"),
    ("2026-12-09", "FOMC 政策金利発表"),
)


def static_us_macro_events(start: datetime, end: datetime) -> list[MacroEvent]:
    events: list[MacroEvent] = []
    for date_str, label in FOMC_DECISION_2026:
        local = datetime.fromisoformat(f"{date_str}T14:00:00").replace(tzinfo=ET)
        scheduled = local.astimezone(timezone.utc)
        if start <= scheduled <= end:
            events.append(
                MacroEvent(
                    event_id=f"fomc-{date_str}",
                    name="FOMC Interest Rate Decision",
                    name_ja=label,
                    country="US",
                    scheduled_at=scheduled,
                    impact="high",
                    source="static_fomc",
                )
            )
    return sorted(events, key=lambda e: e.scheduled_at)
