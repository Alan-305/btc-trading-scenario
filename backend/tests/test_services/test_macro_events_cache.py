from datetime import datetime, timezone

from app.schemas.macro_events import MacroEvent, MacroEventsResponse
from app.services.macro_events_cache import (
    is_live_macro_response,
    merge_with_last_good,
    should_bypass_short_cache,
)


def _event(day: int, hour: int = 12) -> MacroEvent:
    return MacroEvent(
        event_id=f"ev-{day}",
        name=f"Event {day}",
        country="US",
        scheduled_at=datetime(2026, 6, day, hour, tzinfo=timezone.utc),
        impact="high",
        source="forex_factory",
    )


def _response(source: str, count: int) -> MacroEventsResponse:
    return MacroEventsResponse(
        events=[_event(i + 1) for i in range(count)],
        source=source,
        window_days=7,
        fetched_at=datetime(2026, 6, 29, tzinfo=timezone.utc),
    )


def test_should_bypass_degraded_cache():
    degraded = _response("static_fomc", 1)
    live = _response("forex_factory", 8)
    assert should_bypass_short_cache(degraded) is True
    assert should_bypass_short_cache(live) is False
    assert should_bypass_short_cache(None) is True


def test_merge_with_last_good_when_live_feed_fails():
    fresh = _response("static_fomc", 1).model_copy(
        update={"note_ja": "Forex Factoryフィードも取得できませんでした。"}
    )
    last_good = _response("forex_factory", 6)
    merged = merge_with_last_good(fresh, last_good)
    assert merged.source == "forex_factory"
    assert len(merged.events) == 6
    assert "取得済みカレンダー" in (merged.note_ja or "")


def test_merge_keeps_fresh_live_response():
    fresh = _response("forex_factory", 5)
    last_good = _response("forex_factory", 3)
    merged = merge_with_last_good(fresh, last_good)
    assert len(merged.events) == 5
    assert is_live_macro_response(merged)
