from __future__ import annotations

from app.schemas.extended_market import MacroContextSnapshot, UsdtDominanceSnapshot

MACRO_CONTEXT_CACHE_TTL = 900
MACRO_CONTEXT_LAST_GOOD_TTL = 86400


def usdt_dominance_has_history(usdt: UsdtDominanceSnapshot | None) -> bool:
    return usdt is not None and len(usdt.history or []) > 0


def merge_usdt_dominance(
    fresh: UsdtDominanceSnapshot | None,
    last_good: UsdtDominanceSnapshot | None,
) -> UsdtDominanceSnapshot | None:
    if fresh is None:
        return last_good
    if last_good is None:
        return fresh
    if (
        fresh.source != last_good.source
        and (fresh.history or [])
        and (last_good.history or [])
    ):
        return fresh
    if not (fresh.history or []) and (last_good.history or []):
        return fresh.model_copy(update={"history": last_good.history})
    return fresh


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
    merged_usdt = merge_usdt_dominance(fresh.usdt_dominance, last_good.usdt_dominance)
    if merged_usdt is not fresh.usdt_dominance:
        updates["usdt_dominance"] = merged_usdt
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
