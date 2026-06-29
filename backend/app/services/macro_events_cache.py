from __future__ import annotations

from app.schemas.macro_events import MacroEventsResponse

LIVE_SOURCES = frozenset({"finnhub", "forex_factory"})
DEGRADED_SOURCES = frozenset({"static_fomc"})


def is_live_macro_response(response: MacroEventsResponse) -> bool:
    return response.source in LIVE_SOURCES and len(response.events) > 0


def should_bypass_short_cache(cached: MacroEventsResponse | None) -> bool:
    """Re-fetch when the short TTL cache only holds degraded fallback data."""
    if cached is None:
        return True
    return cached.source in DEGRADED_SOURCES


def merge_with_last_good(
    fresh: MacroEventsResponse,
    last_good: MacroEventsResponse | None,
) -> MacroEventsResponse:
    if is_live_macro_response(fresh):
        return fresh
    if last_good and is_live_macro_response(last_good):
        note = (fresh.note_ja or "ライブフィードを取得できませんでした。").strip()
        if "取得済みカレンダー" not in note:
            note = f"{note} 直近の取得済みカレンダーを表示しています。"
        return last_good.model_copy(update={"note_ja": note})
    return fresh
