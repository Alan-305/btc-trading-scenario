from __future__ import annotations

import csv
import json
import re
from datetime import datetime, timezone
from io import StringIO
from zoneinfo import ZoneInfo

import asyncio

import httpx
import structlog

from app.collectors.http_client import CollectorHttpClient
from app.schemas.macro_events import MacroEvent
from app.services.macro_event_labels import event_name_ja

logger = structlog.get_logger()

FF_THIS_WEEK_CSV = "https://nfs.faireconomy.media/ff_calendar_thisweek.csv"
FF_THIS_WEEK_JSON = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"

ET = ZoneInfo("America/New_York")
FF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; btc-trading-scenario/1.0)",
    "Accept": "text/csv,application/json,*/*",
}

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

_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})\s*(am|pm)$", re.IGNORECASE)


class ForexFactoryCalendarClient:
    """Free public economic calendar (Forex Factory via Fair Economy CDN)."""

    def __init__(self, http: CollectorHttpClient):
        self.http = http

    async def fetch_events(
        self,
        *,
        start: datetime,
        end: datetime,
        include_next_week: bool = False,  # noqa: ARG002 — next-week feed is currently 404
    ) -> list[MacroEvent]:
        rows: list[dict] = []
        for url, parser in (
            (FF_THIS_WEEK_JSON, _parse_json_feed),
            (FF_THIS_WEEK_CSV, _parse_csv_feed),
        ):
            parsed = await self._fetch_feed(url, parser)
            if parsed:
                rows.extend(parsed)
                break

        events: list[MacroEvent] = []
        for i, row in enumerate(rows):
            event = _parse_row(row, i, start, end)
            if event:
                events.append(event)

        return sorted(events, key=lambda e: e.scheduled_at)

    async def _fetch_feed(self, url: str, parser) -> list[dict]:
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                body = await self.http.get_text(
                    url,
                    headers=FF_HEADERS,
                    rate_limit_key="forexfactory",
                )
                parsed = parser(body)
                if parsed:
                    return parsed
            except httpx.HTTPStatusError as exc:
                last_error = exc
                if exc.response.status_code in (429, 503, 502) and attempt < 2:
                    await asyncio.sleep(0.6 * (attempt + 1))
                    continue
                logger.warning("forexfactory_calendar_failed", url=url, error=str(exc))
                break
            except Exception as exc:
                last_error = exc
                if attempt < 2:
                    await asyncio.sleep(0.4 * (attempt + 1))
                    continue
                logger.warning("forexfactory_calendar_failed", url=url, error=str(exc))
                break
        if last_error:
            logger.warning("forexfactory_calendar_exhausted", url=url, error=str(last_error))
        return []


def _parse_csv_feed(body: str) -> list[dict]:
    if not body.strip() or body.lstrip().startswith("<"):
        return []
    reader = csv.DictReader(StringIO(body))
    rows: list[dict] = []
    for row in reader:
        rows.append(
            {
                "title": (row.get("Title") or "").strip(),
                "country": (row.get("Country") or "").strip().upper(),
                "date": (row.get("Date") or "").strip(),
                "time": (row.get("Time") or "").strip(),
                "impact": (row.get("Impact") or "medium").strip(),
                "forecast": (row.get("Forecast") or "").strip(),
                "previous": (row.get("Previous") or "").strip(),
            }
        )
    return rows


def _parse_json_feed(body: str) -> list[dict]:
    data = json.loads(body)
    if not isinstance(data, list):
        return []
    return data


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

    scheduled = _parse_scheduled(row, currency)
    if scheduled is None or scheduled < start or scheduled > end:
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


def _parse_scheduled(row: dict, currency: str) -> datetime | None:
    date_raw = row.get("date")
    if not date_raw:
        return None

    date_str = str(date_raw).strip()
    if "T" in date_str:
        try:
            scheduled = datetime.fromisoformat(date_str)
            if scheduled.tzinfo is None:
                return scheduled.replace(tzinfo=timezone.utc)
            return scheduled.astimezone(timezone.utc)
        except ValueError:
            return None

    parts = date_str.split("-")
    if len(parts) != 3:
        return None
    try:
        month, day, year = int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError:
        return None

    hour, minute = _parse_ff_time(str(row.get("time") or ""))
    # Fair Economy CSV timestamps are UTC (JSON feed uses explicit ET offsets).
    local = datetime(year, month, day, hour, minute, tzinfo=timezone.utc)
    return local


def _parse_ff_time(time_raw: str) -> tuple[int, int]:
    normalized = time_raw.strip().lower().replace(" ", "")
    if normalized in ("", "allday", "tentative", "day"):
        return 12, 0

    match = _TIME_RE.match(normalized)
    if not match:
        return 12, 0

    hour = int(match.group(1))
    minute = int(match.group(2))
    meridiem = match.group(3).lower()
    if meridiem == "pm" and hour != 12:
        hour += 12
    elif meridiem == "am" and hour == 12:
        hour = 0
    return hour, minute
