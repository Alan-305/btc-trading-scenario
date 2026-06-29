from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import structlog

from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.integrations.forex_factory_calendar import ForexFactoryCalendarClient
from app.data.us_macro_static import static_us_macro_events
from app.schemas.macro_events import MacroEvent, MacroEventsResponse
from app.services.macro_event_labels import event_name_ja

logger = structlog.get_logger()

FINNHUB_CALENDAR = "https://finnhub.io/api/v1/calendar/economic"
ET = ZoneInfo("America/New_York")

IMPACT_MAP = {
    "low": "low",
    "medium": "medium",
    "high": "high",
    "": "medium",
}

class MacroEventsService:
    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    async def fetch(self, *, days: int = 7) -> MacroEventsResponse:
        days = max(1, min(days, 30))
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=min(3, days))
        end = now + timedelta(days=days)

        key = (self._settings.finnhub_api_key or "").strip()
        finnhub_error = False
        if key:
            finnhub_events = await self._fetch_finnhub(start, end, key)
            if finnhub_events:
                return MacroEventsResponse(
                    events=finnhub_events,
                    source="finnhub",
                    window_days=days,
                    fetched_at=now,
                )
            finnhub_error = True

        ff_client = ForexFactoryCalendarClient(self.http)
        ff_events = await ff_client.fetch_events(
            start=start,
            end=end,
            include_next_week=days > 5,
        )
        if ff_events:
            note = None
            if finnhub_error and key:
                note = (
                    "Finnhubの経済カレンダーは無料プランでは利用できないため、"
                    "Forex Factoryの公開フィードを表示しています。"
                )
            return MacroEventsResponse(
                events=ff_events,
                source="forex_factory",
                window_days=days,
                fetched_at=now,
                note_ja=note,
            )

        static_events = static_us_macro_events(start, end)
        if not key:
            note = "経済カレンダーフィードを取得できませんでした。FOMC日程のみ表示しています。"
        elif finnhub_error:
            note = (
                "Finnhubの経済カレンダーは有料プラン向けです（無料キーでは利用不可）。"
                "Forex Factoryフィードも取得できなかったため、FOMC静的データのみです。"
            )
        else:
            note = "経済カレンダーの取得に失敗したため、FOMC日程のみ表示しています。"
        return MacroEventsResponse(
            events=static_events,
            source="static_fomc",
            window_days=days,
            fetched_at=now,
            note_ja=note if static_events or not key else "経済イベントを取得できませんでした。",
        )

    async def _fetch_finnhub(self, start: datetime, end: datetime, api_key: str) -> list[MacroEvent]:
        try:
            data = await self.http.get_json(
                FINNHUB_CALENDAR,
                params={
                    "from": start.date().isoformat(),
                    "to": end.date().isoformat(),
                    "token": api_key,
                },
                rate_limit_key="finnhub",
            )
            if data.get("error"):
                logger.warning("finnhub_calendar_denied", error=data.get("error"))
                return []
            rows = data.get("economicCalendar") or []
            events: list[MacroEvent] = []
            for i, row in enumerate(rows):
                country = (row.get("country") or "").upper()
                impact_raw = (row.get("impact") or "medium").lower()
                impact = IMPACT_MAP.get(impact_raw, "medium")
                if country == "US":
                    if impact == "low":
                        continue
                elif impact != "high":
                    continue

                name = (row.get("event") or "").strip()
                if not name:
                    continue
                scheduled = _parse_finnhub_time(row.get("date"), row.get("time"), country)
                if scheduled is None or scheduled < start or scheduled > end:
                    continue

                events.append(
                    MacroEvent(
                        event_id=f"finnhub-{country}-{scheduled.isoformat()}-{i}",
                        name=name,
                        name_ja=event_name_ja(name),
                        country=country,
                        scheduled_at=scheduled,
                        impact=impact,  # type: ignore[arg-type]
                        estimate=_fmt_num(row.get("estimate")),
                        actual=_fmt_num(row.get("actual")),
                        previous=_fmt_num(row.get("prev")),
                        source="finnhub",
                    )
                )

            return sorted(events, key=lambda e: e.scheduled_at)
        except Exception as exc:
            logger.warning("finnhub_calendar_failed", error=str(exc))
            return []


def _parse_finnhub_time(date_raw: object, time_raw: object, country: str) -> datetime | None:
    if not date_raw:
        return None
    date_str = str(date_raw)[:10]
    try:
        base = date.fromisoformat(date_str)
    except ValueError:
        return None

    hour, minute = 12, 0
    if time_raw:
        parts = str(time_raw).strip().split(":")
        if len(parts) >= 2:
            try:
                hour = int(parts[0])
                minute = int(parts[1])
            except ValueError:
                pass

    tz = ET if country == "US" else timezone.utc
    local = datetime(base.year, base.month, base.day, hour, minute, tzinfo=tz)
    return local.astimezone(timezone.utc)


def _fmt_num(value: object) -> str | None:
    if value is None or value == "":
        return None
    return str(value)
