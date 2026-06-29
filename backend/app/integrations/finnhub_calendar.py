from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import structlog

from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.data.us_macro_static import static_us_macro_events
from app.schemas.macro_events import MacroEvent, MacroEventsResponse

logger = structlog.get_logger()

FINNHUB_CALENDAR = "https://finnhub.io/api/v1/calendar/economic"
ET = ZoneInfo("America/New_York")

IMPACT_MAP = {
    "low": "low",
    "medium": "medium",
    "high": "high",
    "": "medium",
}

# Japanese labels for common US events
EVENT_JA: dict[str, str] = {
    "fomc": "FOMC 政策金利発表",
    "cpi": "米CPI",
    "consumer price index": "米CPI",
    "nonfarm": "米雇用統計",
    "non-farm": "米雇用統計",
    "payroll": "米雇用統計",
    "gdp": "米GDP",
    "ppi": "米PPI",
    "retail sales": "米小売売上",
    "ism manufacturing": "米ISM製造業",
    "ism services": "米ISMサービス業",
    "initial jobless": "米新規失業保険申請",
    "fed chair": "FRB議長発言",
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
        if key:
            finnhub_events = await self._fetch_finnhub(start, end, key)
            if finnhub_events:
                return MacroEventsResponse(
                    events=finnhub_events,
                    source="finnhub",
                    window_days=days,
                    fetched_at=now,
                )

        static_events = static_us_macro_events(start, end)
        note = (
            "Finnhub APIキー未設定のため、FOMC日程のみ表示しています。"
            "CPI・雇用統計などは `.env` に `FINNHUB_API_KEY` を設定してください。"
            if not key
            else "経済カレンダーの取得に失敗したため、FOMC日程のみ表示しています。"
        )
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
                        name_ja=_event_name_ja(name),
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


def _event_name_ja(name: str) -> str | None:
    lower = name.lower()
    for key, ja in EVENT_JA.items():
        if key in lower:
            return ja
    return None
