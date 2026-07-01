from datetime import datetime, timezone

from app.schemas.extended_market import MacroContextSnapshot, MacroSeriesPoint, UsdtDominanceSnapshot
from app.services.macro_context_cache import (
    macro_context_has_data,
    merge_macro_context,
    merge_usdt_dominance,
    usdt_dominance_has_history,
)


def _usdt(pct: float, history: list | None = None) -> UsdtDominanceSnapshot:
    return UsdtDominanceSnapshot(
        dominance_pct=pct,
        change_7d_pct=None,
        trend="stable",
        history=history or [],
        source="test",
        timestamp=None,
    )


def _history_point(pct: float) -> MacroSeriesPoint:
    return MacroSeriesPoint(ts=datetime(2026, 7, 1, tzinfo=timezone.utc), value=pct)


def test_merge_macro_context_keeps_last_good_usdt():
    fresh = MacroContextSnapshot(
        options=None,
        etf_flows=None,
        onchain=None,
        usdt_dominance=None,
        equity_markets=None,
        fetched_at=None,
    )
    last_good = fresh.model_copy(update={"usdt_dominance": _usdt(8.4)})
    merged = merge_macro_context(fresh, last_good)
    assert merged.usdt_dominance is not None
    assert merged.usdt_dominance.dominance_pct == 8.4


def test_macro_context_has_data():
    assert not macro_context_has_data(MacroContextSnapshot(fetched_at=None))
    assert macro_context_has_data(
        MacroContextSnapshot(usdt_dominance=_usdt(8.4), fetched_at=None)
    )


def test_merge_usdt_dominance_restores_history():
    fresh = _usdt(8.52, history=[])
    last_good = _usdt(8.4, history=[_history_point(8.4), _history_point(8.5)])
    merged = merge_usdt_dominance(fresh, last_good)
    assert merged is not None
    assert merged.dominance_pct == 8.52
    assert len(merged.history) == 2


def test_merge_macro_context_restores_usdt_history():
    fresh = MacroContextSnapshot(
        options=None,
        etf_flows=None,
        onchain=None,
        usdt_dominance=_usdt(8.52, history=[]),
        equity_markets=None,
        fetched_at=None,
    )
    last_good = fresh.model_copy(
        update={"usdt_dominance": _usdt(8.4, history=[_history_point(8.4)])}
    )
    merged = merge_macro_context(fresh, last_good)
    assert merged.usdt_dominance is not None
    assert len(merged.usdt_dominance.history) == 1
    assert merged.usdt_dominance.dominance_pct == 8.52


def test_usdt_dominance_has_history():
    assert not usdt_dominance_has_history(_usdt(8.4))
    assert usdt_dominance_has_history(_usdt(8.4, history=[_history_point(8.4)]))
