from datetime import datetime, timezone

import pytest

from app.services.market_calendar import (
    MarketStatus,
    stock_market_day_label,
    stock_market_status,
)
from app.services.market_calendar import MARKET_BY_ID


def test_japan_weekend_closed():
    # Saturday 2026-06-27 00:00 UTC = 09:00 JST Saturday
    instant = datetime(2026, 6, 27, 0, 0, tzinfo=timezone.utc)
    jp = MARKET_BY_ID["japan"]
    assert stock_market_status(instant, jp) == MarketStatus.WEEKEND
    assert "土日" in stock_market_day_label(instant, jp)


def test_us_holiday_independence_day():
    # 2026-07-04 15:00 UTC = 11:00 ET on Independence Day (Saturday in 2026 actually)
    # Use 2025-07-04 Friday
    instant = datetime(2025, 7, 4, 15, 0, tzinfo=timezone.utc)
    us = MARKET_BY_ID["us"]
    assert stock_market_status(instant, us) == MarketStatus.HOLIDAY


def test_japan_open_during_session():
    # Wednesday 2026-06-25 01:00 UTC = 10:00 JST
    instant = datetime(2026, 6, 25, 1, 0, tzinfo=timezone.utc)
    jp = MARKET_BY_ID["japan"]
    assert stock_market_status(instant, jp) == MarketStatus.OPEN


def test_japan_lunch_break():
    # 2026-06-25 02:30 UTC = 11:30 JST
    instant = datetime(2026, 6, 25, 2, 30, tzinfo=timezone.utc)
    jp = MARKET_BY_ID["japan"]
    assert stock_market_status(instant, jp) == MarketStatus.OFF_HOURS
