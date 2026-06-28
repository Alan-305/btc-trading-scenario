from __future__ import annotations

from app.schemas.candles import TechnicalAnalysisResponse
from app.schemas.scenario import TradeSide
from app.services.price_sanity import is_plausible_usd_price
from app.services.scenario_market_context import HeatmapSummary, ScenarioMarketContext

DEFAULT_ATR_PCT = 0.025
MIN_RR = 1.5


def resolve_atr_pct(price: float, ta: TechnicalAnalysisResponse | None) -> float:
    """ATR as fraction of price; fallback to ~2.5% when unavailable."""
    if price <= 0:
        return DEFAULT_ATR_PCT
    if ta and ta.atr_14 is not None and ta.atr_14 > 0:
        return max(0.008, min(0.06, ta.atr_14 / price))
    return DEFAULT_ATR_PCT


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
    price: float,
    side: TradeSide,
    ta: TechnicalAnalysisResponse | None,
    context: ScenarioMarketContext,
) -> tuple[list[float], float]:
    atr_pct = resolve_atr_pct(price, ta)
    heatmap = context.heatmap
    ask_levels = list(heatmap.ask_resistance_levels) if heatmap else []
    bid_levels = list(heatmap.bid_support_levels) if heatmap else []

    if side == "long":
        sl_dist = price * atr_pct * 1.2
        stop_loss = round(price - sl_dist, 2)
        tp1 = round(price + price * atr_pct * 1.5, 2)
        tp2 = round(price + price * atr_pct * 2.5, 2)

        resistances: list[float] = []
        if ta and ta.resistance:
            resistances.append(ta.resistance)
        resistances.extend(
            lvl
            for lvl in ask_levels
            if lvl > price and is_plausible_usd_price(lvl, price, min_ratio=1.0, max_ratio=1.15)
        )
        if resistances:
            nearest = min(resistances)
            tp1 = round(min(tp1, nearest * 0.998), 2)
            if len(resistances) >= 2:
                second = sorted(resistances)[1] if len(resistances) > 1 else None
                if second and second > tp1:
                    tp2 = round(min(tp2, second * 0.998), 2)

        if context.risk_zones and context.risk_zones.long_liquidation:
            liq_low = context.risk_zones.long_liquidation.zone_low
            if is_plausible_usd_price(liq_low, price, min_ratio=0.85, max_ratio=1.0):
                stop_loss = round(min(stop_loss, liq_low * 0.995), 2)

        take_profit = sorted({tp1, tp2})
        entry_mid = price
        take_profit, stop_loss = _enforce_min_reward_risk(entry_mid, "long", take_profit, stop_loss)
        return take_profit, stop_loss

    if side == "short":
        sl_dist = price * atr_pct * 1.2
        stop_loss = round(price + sl_dist, 2)
        tp1 = round(price - price * atr_pct * 1.5, 2)
        tp2 = round(price - price * atr_pct * 2.5, 2)

        supports: list[float] = []
        if ta and ta.support:
            supports.append(ta.support)
        supports.extend(
            lvl
            for lvl in bid_levels
            if lvl < price and is_plausible_usd_price(lvl, price, min_ratio=0.85, max_ratio=1.0)
        )
        if supports:
            nearest = max(supports)
            tp1 = round(max(tp1, nearest * 1.002), 2)
            if len(supports) >= 2:
                second = sorted(supports, reverse=True)[1]
                if second < tp1:
                    tp2 = round(max(tp2, second * 1.002), 2)

        if context.risk_zones and context.risk_zones.short_squeeze:
            sq_high = context.risk_zones.short_squeeze.zone_high
            if is_plausible_usd_price(sq_high, price, min_ratio=1.0, max_ratio=1.15):
                stop_loss = round(max(stop_loss, sq_high * 1.005), 2)

        take_profit = sorted({tp1, tp2}, reverse=True)
        take_profit, stop_loss = _enforce_min_reward_risk(price, "short", take_profit, stop_loss)
        return take_profit, stop_loss

    take_profit = [round(price * (1 + atr_pct * 0.8), 2)]
    stop_loss = round(price * (1 - atr_pct * 0.8), 2)
    return take_profit, stop_loss


def _enforce_min_reward_risk(
    entry: float,
    side: TradeSide,
    take_profit: list[float],
    stop_loss: float,
    min_rr: float = MIN_RR,
) -> tuple[list[float], float]:
    if not take_profit or entry <= 0:
        return take_profit, stop_loss

    if side == "long":
        risk = entry - stop_loss
        if risk <= 0:
            return take_profit, stop_loss
        reward = take_profit[0] - entry
        if reward <= 0:
            return take_profit, stop_loss
        if reward < risk * min_rr:
            tighter_sl = round(entry - reward / min_rr, 2)
            if tighter_sl > stop_loss:
                stop_loss = tighter_sl
            else:
                take_profit[0] = round(entry + risk * min_rr, 2)
        if len(take_profit) >= 2 and take_profit[1] <= take_profit[0]:
            risk = entry - stop_loss
            take_profit[1] = round(take_profit[0] + risk * 0.8, 2)
    elif side == "short":
        risk = stop_loss - entry
        if risk <= 0:
            return take_profit, stop_loss
        reward = entry - take_profit[0]
        if reward <= 0:
            return take_profit, stop_loss
        if reward < risk * min_rr:
            tighter_sl = round(entry + reward / min_rr, 2)
            if tighter_sl < stop_loss:
                stop_loss = tighter_sl
            else:
                take_profit[0] = round(entry - risk * min_rr, 2)
        if len(take_profit) >= 2 and take_profit[1] >= take_profit[0]:
            risk = stop_loss - entry
            take_profit[1] = round(take_profit[0] - risk * 0.8, 2)

    return take_profit, stop_loss
