from __future__ import annotations

from datetime import datetime, timezone

import structlog

from app.collectors.http_client import CollectorHttpClient
from app.schemas.macro_events import MacroEvent
from app.services.macro_event_labels import event_name_ja

logger = structlog.get_logger()

FF_THIS_WEEK = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
FF_NEXT_WEEK = "https://nfs.faireconomy.media/ff_calendar_nextweek.json"

IMPACT_MAP = {
    "high": "high",
    "medium": "medium",
    "low": "low",
    "holiday": "low",
}

# Forex Factory uses currency codes (USD) — normalize for UI / writer facts.
COUNTRY_MAP = {
    "USD": "US",
    "EUR": "EU",
    "GBP": "UK",
    "JPY": "JP",
    "AUD": "AU",
    "CAD": "CA",
    "CHF": "CH",
    "NZD": "NZ",
    "CNY": "CN",
}


class ForexFactoryCalendarClient:
    """Free public economic calendar JSON (Forex Factory via Fair Economy CDN)."""

    def __init__(self, http: CollectorHttpClient):
        self.http = http

    async def fetch_events(
        self,
        *,
        start: datetime,
        end: datetime,
        include_next_week: bool = False,
    ) -> list[MacroEvent]:
        urls = [FF_THIS_WEEK]
        if include_next_week:
            urls.append(FF_NEXT_WEEK)

        rows: list[dict] = []
        for url in urls:
            try:
                data = await self.http.get_json(
                    url,
                    headers={"User-Agent": "btc-trading-scenario/1.0"},
                    rate_limit_key="forexfactory",
                )
                if isinstance(data, list):
                    rows.extend(data)
            except Exception as exc:
                logger.warning("forexfactory_calendar_failed", url=url, error=str(exc))

        events: list[MacroEvent] = []
        for i, row in enumerate(rows):
            event = _parse_row(row, i, start, end)
            if event:
                events.append(event)

        return sorted(events, key=lambda e: e.scheduled_at)


def _parse_row(row: dict, index: int, start: datetime, end: datetime) -> MacroEvent | None:
    title = (row.get("title") or "").strip()
    currency = (row.get("country") or "").strip().upper()
    if not title or not currency:
        return None

    country = COUNTRY_MAP.get(currency, currency[:2])
    impact_raw = (row.get("impact") or "medium").strip().lower()
    impact = IMPACT_MAP.get(impact_raw, "medium")

    if country == "US":
        if impact == "low":
            return None
    elif impact != "high":
        return None

    date_raw = row.get("date")
    if not date_raw:
        return None
    try:
        scheduled = datetime.fromisoformat(str(date_raw))
        if scheduled.tzinfo is None:
            scheduled = scheduled.replace(tzinfo=timezone.utc)
        else:
            scheduled = scheduled.astimezone(timezone.utc)
    except ValueError:
        return None

    if scheduled < start or scheduled > end:
        return None

    return MacroEvent(
        event_id=f"ff-{country}-{scheduled.isoformat()}-{index}",
        name=title,
        name_ja=event_name_ja(title),
        country=country,
        scheduled_at=scheduled,
        impact=impact,  # type: ignore[arg-type]
        estimate=(row.get("forecast") or None) or None,
        actual=(row.get("actual") or None) or None,
        previous=(row.get("previous") or None) or None,
        source="forex_factory",
    )
