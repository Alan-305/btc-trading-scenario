from __future__ import annotations

from app.schemas.liquidation import LiquidationClusters, LiquidationEvent
from app.services.price_sanity import is_plausible_usd_price

DEFAULT_BIN_PCT = 0.004
MIN_CLUSTER_NOTIONAL_USD = 250_000.0


def build_liquidation_clusters(
    events: list[LiquidationEvent],
    reference_price: float,
    *,
    bin_pct: float = DEFAULT_BIN_PCT,
    min_notional_usd: float = MIN_CLUSTER_NOTIONAL_USD,
) -> LiquidationClusters | None:
    if reference_price <= 0 or not events:
        return None

    long_events = [
        e
        for e in events
        if e.position_side == "long"
        and e.price < reference_price
        and is_plausible_usd_price(e.price, reference_price, min_ratio=0.85, max_ratio=1.0)
    ]
    short_events = [
        e
        for e in events
        if e.position_side == "short"
        and e.price > reference_price
        and is_plausible_usd_price(e.price, reference_price, min_ratio=1.0, max_ratio=1.15)
    ]

    long_bin = _strongest_bin(long_events, reference_price, bin_pct)
    short_bin = _strongest_bin(short_events, reference_price, bin_pct)

    if not long_bin and not short_bin:
        return None

    result = LiquidationClusters(source="okx")
    if long_bin and long_bin[2] >= min_notional_usd:
        result.long_zone_low = long_bin[0]
        result.long_zone_high = long_bin[1]
        result.long_notional_usd = round(long_bin[2], 2)
        result.long_event_count = long_bin[3]
    if short_bin and short_bin[2] >= min_notional_usd:
        result.short_zone_low = short_bin[0]
        result.short_zone_high = short_bin[1]
        result.short_notional_usd = round(short_bin[2], 2)
        result.short_event_count = short_bin[3]

    if result.long_zone_low is None and result.short_zone_low is None:
        return None
    return result


def _strongest_bin(
    events: list[LiquidationEvent],
    reference_price: float,
    bin_pct: float,
) -> tuple[float, float, float, int] | None:
    if not events:
        return None

    bin_width = reference_price * bin_pct
    if bin_width <= 0:
        return None

    totals: dict[int, float] = {}
    counts: dict[int, int] = {}
    for event in events:
        idx = int((event.price - reference_price) / bin_width)
        totals[idx] = totals.get(idx, 0.0) + event.notional_usd
        counts[idx] = counts.get(idx, 0) + 1

    best_idx = max(totals, key=totals.get)
    center = reference_price + (best_idx + 0.5) * bin_width
    half = bin_width / 2
    return (
        round(center - half, 2),
        round(center + half, 2),
        totals[best_idx],
        counts[best_idx],
    )
