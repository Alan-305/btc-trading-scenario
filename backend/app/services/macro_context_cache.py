from __future__ import annotations

from app.schemas.extended_market import MacroContextSnapshot

MACRO_CONTEXT_CACHE_TTL = 900
MACRO_CONTEXT_LAST_GOOD_TTL = 86400


def macro_context_has_data(snapshot: MacroContextSnapshot) -> bool:
    return any(
        (
            snapshot.options,
            snapshot.etf_flows,
            snapshot.onchain,
            snapshot.usdt_dominance,
            snapshot.equity_markets,
        )
    )


def merge_macro_context(
    fresh: MacroContextSnapshot,
    last_good: MacroContextSnapshot | None,
) -> MacroContextSnapshot:
    if not last_good:
        return fresh

    updates: dict = {}
    if fresh.usdt_dominance is None and last_good.usdt_dominance is not None:
        updates["usdt_dominance"] = last_good.usdt_dominance
    if fresh.equity_markets is None and last_good.equity_markets is not None:
        updates["equity_markets"] = last_good.equity_markets
    if fresh.options is None and last_good.options is not None:
        updates["options"] = last_good.options
    if fresh.etf_flows is None and last_good.etf_flows is not None:
        updates["etf_flows"] = last_good.etf_flows
    if fresh.onchain is None and last_good.onchain is not None:
        updates["onchain"] = last_good.onchain

    if not updates:
        return fresh
    return fresh.model_copy(update=updates)
