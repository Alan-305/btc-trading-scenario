import pytest
from datetime import datetime, timezone

from app.services.market_sessions import MarketSessionsService


def test_market_sessions_build():
    # Wednesday 2026-06-25 07:30 UTC = 16:30 JST — Europe active
    now = datetime(2026, 6, 25, 7, 30, tzinfo=timezone.utc)
    resp = MarketSessionsService().build(now)

    assert len(resp.clocks) == 3
    assert any(c.label_ja == "日本時間" for c in resp.clocks)
    assert len(resp.sessions) == 3
    assert len(resp.timeline_jst) == 24
    assert resp.entry_hint.summary_ja

    europe = next(s for s in resp.sessions if s.id == "europe")
    assert europe.status == "active"
    assert "whitebit" in europe.linked_exchanges

    asia = next(s for s in resp.sessions if s.id == "asia")
    assert "bitbank" in asia.linked_exchanges


def test_timeline_marks_now_hour():
    now = datetime(2026, 6, 25, 0, 30, tzinfo=timezone.utc)  # 09:30 JST
    resp = MarketSessionsService().build(now)
    now_cells = [t for t in resp.timeline_jst if t.is_now]
    assert len(now_cells) == 1
    assert now_cells[0].jst_hour == 9
