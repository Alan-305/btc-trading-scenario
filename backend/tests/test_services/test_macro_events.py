from datetime import datetime, timezone

from app.data.us_macro_static import static_us_macro_events
from app.integrations.forex_factory_calendar import _parse_row
from app.services.macro_event_labels import event_name_ja


def test_static_fomc_in_window():
    start = datetime(2026, 6, 1, tzinfo=timezone.utc)
    end = datetime(2026, 6, 30, tzinfo=timezone.utc)
    events = static_us_macro_events(start, end)
    assert any("FOMC" in (e.name_ja or e.name) for e in events)
    assert all(e.impact == "high" for e in events)


def test_event_name_ja_cpi():
    assert event_name_ja("Consumer Price Index (MoM)") == "米CPI"


def test_forex_factory_us_high_impact_parsed():
    start = datetime(2026, 6, 1, tzinfo=timezone.utc)
    end = datetime(2026, 7, 31, tzinfo=timezone.utc)
    row = {
        "title": "Nonfarm Payrolls",
        "country": "USD",
        "date": "2026-07-03T08:30:00-04:00",
        "impact": "High",
        "forecast": "180K",
        "previous": "200K",
    }
    ev = _parse_row(row, 0, start, end)
    assert ev is not None
    assert ev.country == "US"
    assert ev.impact == "high"
    assert ev.source == "forex_factory"


def test_forex_factory_csv_row_parsed():
    start = datetime(2026, 6, 1, tzinfo=timezone.utc)
    end = datetime(2026, 7, 31, tzinfo=timezone.utc)
    row = {
        "title": "Non-Farm Employment Change",
        "country": "USD",
        "date": "07-02-2026",
        "time": "12:30pm",
        "impact": "High",
        "forecast": "180K",
        "previous": "200K",
    }
    ev = _parse_row(row, 0, start, end)
    assert ev is not None
    assert ev.country == "US"
    assert ev.scheduled_at.hour == 16
    assert ev.scheduled_at.minute == 30
