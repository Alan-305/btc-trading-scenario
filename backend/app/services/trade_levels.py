from __future__ import annotations

from app.schemas.candles import TechnicalAnalysisResponse
from app.schemas.scenario import TradeSide
from app.services.price_sanity import is_plausible_usd_price
from app.services.scenario_market_context import HeatmapSummary, ScenarioMarketContext

DEFAULT_ATR_PCT = 0.025
MIN_RR = 1.5
MAX_SL_ATR_MULT = 2.0
TP1_ATR_MULT = 1.5
TP2_ATR_MULT = 2.5
BASE_SL_ATR_MULT = 1.2


def resolve_atr_pct(price: float, ta: TechnicalAnalysisResponse | None) -> float:
    """ATR as fraction of price; fallback to ~2.5% when unavailable."""
    if price <= 0:
        return DEFAULT_ATR_PCT
    if ta and ta.atr_14 is not None and ta.atr_14 > 0:
        return max(0.008, min(0.06, ta.atr_14 / price))
    return DEFAULT_ATR_PCT


def entry_reference(entry_low: float, entry_high: float, spot_price: float) -> float:
    if entry_low > 0 and entry_high > 0:
        return (entry_low + entry_high) / 2
    return spot_price


def reward_risk_ratio(
    entry: float,
    side: TradeSide,
    take_profit: list[float],
    stop_loss: float,
) -> float | None:
    if not take_profit or entry <= 0:
        return None
    if side == "long":
        risk = entry - stop_loss
        reward = take_profit[0] - entry
    elif side == "short":
        risk = stop_loss - entry
        reward = entry - take_profit[0]
    else:
        return None
    if risk <= 0 or reward <= 0:
        return None
    return reward / risk


def compute_entry_zone(
    price: float,
    side: TradeSide,
    ta: TechnicalAnalysisResponse | None,
    heatmap: HeatmapSummary | None,
    *,
    confidence: float,
) -> tuple[float, float]:
    atr_pct = resolve_atr_pct(price, ta)
    band = max(0.004, atr_pct * 0.45 * (1.15 if confidence < 0.5 else 1.0))

    bid_levels = list(heatmap.bid_support_levels) if heatmap else []
    ask_levels = list(heatmap.ask_resistance_levels) if heatmap else []
    if heatmap and heatmap.strongest_bid_support_usd and heatmap.strongest_bid_support_usd not in bid_levels:
        bid_levels.insert(0, heatmap.strongest_bid_support_usd)
    if heatmap and heatmap.strongest_ask_resistance_usd and heatmap.strongest_ask_resistance_usd not in ask_levels:
        ask_levels.insert(0, heatmap.strongest_ask_resistance_usd)

    if side == "long":
        entry_low = round(price * (1 - band), 2)
        entry_high = round(price * (1 + band * 0.35), 2)
        if ta and ta.support:
            entry_low = round(min(entry_low, ta.support * 1.001), 2)
            entry_high = round(max(entry_high, min(ta.support * 1.008, price * 1.01)), 2)
        for level in bid_levels:
            if level < price and is_plausible_usd_price(level, price, min_ratio=0.85, max_ratio=1.0):
                entry_low = round(min(entry_low, level * 1.002), 2)
                entry_high = round(max(entry_high, min(level * 1.012, price * 1.008)), 2)
                break
        if len(bid_levels) >= 2:
            secondary = bid_levels[1]
            if secondary < price and secondary > entry_low:
                entry_low = round(min(entry_low, secondary * 1.001), 2)
    elif side == "short":
        entry_low = round(price * (1 - band * 0.35), 2)
        entry_high = round(price * (1 + band), 2)
        if ta and ta.resistance:
            entry_high = round(min(entry_high, max(ta.resistance * 1.002, price * 1.005)), 2)
            entry_low = round(max(entry_low, ta.resistance * 0.992), 2)
        for level in ask_levels:
            if level > price and is_plausible_usd_price(level, price, min_ratio=1.0, max_ratio=1.15):
                entry_high = round(min(entry_high, level * 1.002), 2)
                entry_low = round(max(entry_low, max(level * 0.988, price * 0.995)), 2)
                break
        if len(ask_levels) >= 2:
            secondary = ask_levels[1]
            if secondary > price and secondary < entry_high:
                entry_high = round(max(entry_high, secondary * 0.999), 2)
    else:
        if ta and ta.support and ta.resistance:
            entry_low = round(ta.support, 2)
            entry_high = round(ta.resistance, 2)
        else:
            entry_low = round(price * (1 - band), 2)
            entry_high = round(price * (1 + band), 2)

    return min(entry_low, entry_high), max(entry_low, entry_high)


def compute_exit_levels(
    entry_ref: float,
    spot_price: float,
    side: TradeSide,
    ta: TechnicalAnalysisResponse | None,
    context: ScenarioMarketContext,
) -> tuple[list[float], float]:
    """Derive TP/SL from entry fill reference, not spot alone."""
    atr_pct = resolve_atr_pct(spot_price, ta)
    max_risk = entry_ref * atr_pct * MAX_SL_ATR_MULT
    heatmap = context.heatmap
    ask_levels = list(heatmap.ask_resistance_levels) if heatmap else []
    bid_levels = list(heatmap.bid_support_levels) if heatmap else []

    if side == "long":
        stop_loss = round(entry_ref - entry_ref * atr_pct * BASE_SL_ATR_MULT, 2)
        tp1 = round(entry_ref + entry_ref * atr_pct * TP1_ATR_MULT, 2)
        tp2 = round(entry_ref + entry_ref * atr_pct * TP2_ATR_MULT, 2)

        liq_sl = _long_liquidation_stop(context, spot_price)
        if liq_sl is not None:
            stop_loss = round(min(stop_loss, liq_sl), 2)

        resistances: list[float] = []
        if ta and ta.resistance:
            resistances.append(ta.resistance)
        resistances.extend(
            lvl
            for lvl in ask_levels
            if lvl > entry_ref and is_plausible_usd_price(lvl, spot_price, min_ratio=1.0, max_ratio=1.15)
        )
        tp1 = _maybe_snap_long_tp(tp1, resistances, entry_ref, stop_loss)
        tp2 = _maybe_snap_long_tp(tp2, sorted(set(resistances))[1:2], entry_ref, stop_loss)

        take_profit = sorted({tp1, tp2})
        return _finalize_exits(entry_ref, "long", take_profit, stop_loss, max_risk)

    if side == "short":
        stop_loss = round(entry_ref + entry_ref * atr_pct * BASE_SL_ATR_MULT, 2)

        sq_sl = _short_squeeze_stop(context, spot_price)
        if sq_sl is not None:
            stop_loss = round(max(stop_loss, sq_sl), 2)

        tp1 = round(entry_ref - entry_ref * atr_pct * TP1_ATR_MULT, 2)
        tp2 = round(entry_ref - entry_ref * atr_pct * TP2_ATR_MULT, 2)

        supports: list[float] = []
        if ta and ta.support:
            supports.append(ta.support)
        supports.extend(
            lvl
            for lvl in bid_levels
            if lvl < entry_ref and is_plausible_usd_price(lvl, spot_price, min_ratio=0.85, max_ratio=1.0)
        )
        tp1 = _maybe_snap_short_tp(tp1, supports, entry_ref, stop_loss)
        deeper = sorted({s for s in supports if s < tp1}, reverse=True)
        if deeper:
            tp2 = _maybe_snap_short_tp(tp2, deeper[:1], entry_ref, stop_loss)

        take_profit = sorted({tp1, tp2}, reverse=True)
        return _finalize_exits(entry_ref, "short", take_profit, stop_loss, max_risk)

    take_profit = [round(entry_ref * (1 + atr_pct * 0.8), 2)]
    stop_loss = round(entry_ref * (1 - atr_pct * 0.8), 2)
    return take_profit, stop_loss


def _long_liquidation_stop(context: ScenarioMarketContext, spot_price: float) -> float | None:
    if not context.risk_zones or not context.risk_zones.long_liquidation:
        return None
    liq_low = context.risk_zones.long_liquidation.zone_low
    if not is_plausible_usd_price(liq_low, spot_price, min_ratio=0.85, max_ratio=1.0):
        return None
    return round(liq_low * 0.995, 2)


def _short_squeeze_stop(context: ScenarioMarketContext, spot_price: float) -> float | None:
    if not context.risk_zones or not context.risk_zones.short_squeeze:
        return None
    sq_high = context.risk_zones.short_squeeze.zone_high
    if not is_plausible_usd_price(sq_high, spot_price, min_ratio=1.0, max_ratio=1.15):
        return None
    return round(sq_high * 1.005, 2)


def _maybe_snap_long_tp(
    tp: float,
    levels: list[float],
    entry_ref: float,
    stop_loss: float,
) -> float:
    if not levels:
        return tp
    nearest = min(levels)
    candidate = round(min(tp, nearest * 0.998), 2)
    if candidate <= entry_ref:
        return tp
    risk = entry_ref - stop_loss
    if risk <= 0:
        return tp
    if candidate - entry_ref >= risk * MIN_RR:
        return candidate
    return tp


def _maybe_snap_short_tp(
    tp: float,
    levels: list[float],
    entry_ref: float,
    stop_loss: float,
) -> float:
    if not levels:
        return tp
    nearest = max(levels)
    candidate = round(min(tp, nearest * 0.998), 2)
    if candidate >= entry_ref:
        return tp
    risk = stop_loss - entry_ref
    if risk <= 0:
        return tp
    if entry_ref - candidate >= risk * MIN_RR:
        return candidate
    return tp


def _finalize_exits(
    entry_ref: float,
    side: TradeSide,
    take_profit: list[float],
    stop_loss: float,
    max_risk: float,
    min_rr: float = MIN_RR,
) -> tuple[list[float], float]:
    if not take_profit or entry_ref <= 0:
        return take_profit, stop_loss

    min_risk = entry_ref * 0.006

    if side == "long":
        stop_loss = round(max(stop_loss, entry_ref - max_risk), 2)
        stop_loss = round(min(stop_loss, entry_ref - min_risk), 2)
        risk = entry_ref - stop_loss
        if risk <= 0:
            stop_loss = round(entry_ref - min_risk, 2)
            risk = entry_ref - stop_loss

        min_reward = risk * min_rr
        if take_profit[0] - entry_ref < min_reward:
            take_profit[0] = round(entry_ref + min_reward, 2)

        if len(take_profit) >= 2:
            if take_profit[1] <= take_profit[0]:
                take_profit[1] = round(take_profit[0] + risk * 0.85, 2)

    elif side == "short":
        stop_loss = round(min(stop_loss, entry_ref + max_risk), 2)
        stop_loss = round(max(stop_loss, entry_ref + min_risk), 2)
        risk = stop_loss - entry_ref
        if risk <= 0:
            stop_loss = round(entry_ref + min_risk, 2)
            risk = stop_loss - entry_ref

        min_reward = risk * min_rr
        if entry_ref - take_profit[0] < min_reward:
            take_profit[0] = round(entry_ref - min_reward, 2)

        if len(take_profit) >= 2:
            if take_profit[1] >= take_profit[0]:
                take_profit[1] = round(take_profit[0] - risk * 0.85, 2)

    return take_profit, stop_loss


def compute_trade_exits(
    entry_low: float,
    entry_high: float,
    spot_price: float,
    side: TradeSide,
    ta: TechnicalAnalysisResponse | None,
    context: ScenarioMarketContext,
) -> tuple[list[float], float]:
    """Entry-aware TP/SL with enforced minimum reward/risk."""
    from app.services.price_sanity import clamp_exit_levels

    entry_ref = entry_reference(entry_low, entry_high, spot_price)
    take_profit, stop_loss = compute_exit_levels(entry_ref, spot_price, side, ta, context)
    take_profit, stop_loss = clamp_exit_levels(entry_ref, spot_price, side, take_profit, stop_loss)
    if not take_profit:
        return compute_exit_levels(entry_ref, spot_price, side, ta, context)
    max_risk = entry_ref * resolve_atr_pct(spot_price, ta) * MAX_SL_ATR_MULT
    return _finalize_exits(entry_ref, side, take_profit, stop_loss, max_risk)
