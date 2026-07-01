from app.schemas.extended_market import MacroContextSnapshot, UsdtDominanceSnapshot
from app.services.macro_context_cache import merge_macro_context, macro_context_has_data


def _usdt(pct: float) -> UsdtDominanceSnapshot:
    return UsdtDominanceSnapshot(
        dominance_pct=pct,
        change_7d_pct=None,
        trend="stable",
        history=[],
        source="test",
        timestamp=None,
    )


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
