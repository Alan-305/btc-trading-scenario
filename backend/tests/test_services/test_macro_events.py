from datetime import datetime, timezone

from app.data.us_macro_static import static_us_macro_events
from app.integrations.finnhub_calendar import _event_name_ja


def test_static_fomc_in_window():
    start = datetime(2026, 6, 1, tzinfo=timezone.utc)
    end = datetime(2026, 6, 30, tzinfo=timezone.utc)
    events = static_us_macro_events(start, end)
    assert any("FOMC" in (e.name_ja or e.name) for e in events)
    assert all(e.impact == "high" for e in events)


def test_event_name_ja_cpi():
    assert _event_name_ja("Consumer Price Index (MoM)") == "米CPI"
