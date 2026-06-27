from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from enum import Enum
from functools import lru_cache
from zoneinfo import ZoneInfo

import holidays

TOKYO = ZoneInfo("Asia/Tokyo")
LONDON = ZoneInfo("Europe/London")
NY = ZoneInfo("America/New_York")

MarketStatusCode = str  # open | weekend | holiday | off_hours


class MarketStatus(str, Enum):
    OPEN = "open"
    WEEKEND = "weekend"
    HOLIDAY = "holiday"
    OFF_HOURS = "off_hours"


@dataclass(frozen=True)
class StockMarketDef:
    id: str
    name_ja: str
    tz: ZoneInfo
    session_start: time
    session_end: time
    holiday_country: str


STOCK_MARKETS: tuple[StockMarketDef, ...] = (
    StockMarketDef(
        "japan",
        "日本（東証）",
        TOKYO,
        time(9, 0),
        time(15, 0),
        "JP",
    ),
    StockMarketDef(
        "europe",
        "欧州（ロンドン）",
        LONDON,
        time(8, 0),
        time(16, 30),
        "GB",
    ),
    StockMarketDef(
        "us",
        "米国（NYSE）",
        NY,
        time(9, 30),
        time(16, 0),
        "US",
    ),
)

MARKET_BY_ID = {m.id: m for m in STOCK_MARKETS}


@lru_cache
def _holiday_dates(country: str, year: int) -> frozenset[date]:
    if country == "JP":
        cal = holidays.Japan(years=year)
    elif country == "US":
        cal = holidays.US(years=year)
    elif country == "GB":
        cal = holidays.UK(years=year)
    else:
        return frozenset()
    return frozenset(cal.keys())


def _calendar_for_year(country: str, year: int) -> holidays.HolidayBase:
    if country == "JP":
        return holidays.Japan(years=year)
    if country == "US":
        return holidays.US(years=year)
    return holidays.UK(years=year)


def _is_japan_lunch_break(local_time: time) -> bool:
    return time(11, 30) <= local_time < time(12, 30)


def stock_market_status(instant: datetime, market: StockMarketDef) -> MarketStatus:
    """指定時刻における現物株式市場の状態（営業時間・土日・祝日）。"""
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=ZoneInfo("UTC"))

    local = instant.astimezone(market.tz)
    local_date = local.date()
    weekday = local.weekday()

    if weekday >= 5:
        return MarketStatus.WEEKEND

    if local_date in _holiday_dates(market.holiday_country, local_date.year):
        return MarketStatus.HOLIDAY

    local_time = local.time()
    if market.id == "japan" and _is_japan_lunch_break(local_time):
        return MarketStatus.OFF_HOURS

    if market.session_start <= local_time < market.session_end:
        return MarketStatus.OPEN

    return MarketStatus.OFF_HOURS


def stock_market_day_label(instant: datetime, market: StockMarketDef) -> str:
    """その日の市場全体の状態（カード表示用）。"""
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=ZoneInfo("UTC"))
    local = instant.astimezone(market.tz)
    local_date = local.date()
    weekday = local.weekday()

    if weekday >= 5:
        return "土日休場"
    if local_date in _holiday_dates(market.holiday_country, local_date.year):
        cal = _calendar_for_year(market.holiday_country, local_date.year)
        holiday_name = cal.get(local_date, "祝日")
        return f"祝日休場（{holiday_name}）"
    return "平日"


def all_stock_statuses(instant: datetime) -> dict[str, MarketStatus]:
    return {m.id: stock_market_status(instant, m) for m in STOCK_MARKETS}


def closure_summary_ja(statuses: dict[str, MarketStatus]) -> str | None:
    """休場・祝日の市場を日本語で要約。"""
    closed: list[str] = []
    for market in STOCK_MARKETS:
        status = statuses[market.id]
        short = market.name_ja.split("（")[0]
        if status == MarketStatus.WEEKEND:
            closed.append(f"{short}・土日")
        elif status == MarketStatus.HOLIDAY:
            closed.append(f"{short}・祝日")

    if not closed:
        return None
    return " / ".join(closed)


def activity_from_stock_markets(statuses: dict[str, MarketStatus]) -> str:
    """株式市場の稼働数からタイムライン色用の活発度を返す。"""
    open_count = sum(1 for s in statuses.values() if s == MarketStatus.OPEN)

    if open_count >= 3:
        return "peak"
    if open_count == 2:
        return "high"
    if open_count == 1:
        return "medium"
    return "low"


def jst_day_type(now: datetime) -> str:
    """JST 基準の今日の区分。"""
    if now.tzinfo is None:
        now = now.replace(tzinfo=ZoneInfo("UTC"))
    jst = now.astimezone(TOKYO)
    wd = jst.weekday()
    if wd >= 5:
        return "weekend"
    if jst.date() in _holiday_dates("JP", jst.year):
        return "holiday"
    return "weekday"


def timeline_caption(day_type: str, now: datetime) -> str:
    if now.tzinfo is None:
        now = now.replace(tzinfo=ZoneInfo("UTC"))
    jst = now.astimezone(TOKYO)
    wd_labels = ["月", "火", "水", "木", "金", "土", "日"]
    wd = wd_labels[jst.weekday()]
    base = f"日本時間・{jst.month}/{jst.day}（{wd}）"

    if day_type == "weekend":
        return f"{base} — 週末（株式市場は日・欧・米とも原則休場）"
    if day_type == "holiday":
        cal = _calendar_for_year("JP", jst.year)
        name = cal.get(jst.date())
        suffix = f" — 日本祝日（{name}）" if name else " — 日本祝日"
        return base + suffix
    return f"{base} — 平日（東証・ロンドン・NYSE の営業時間・祝日を反映）"
