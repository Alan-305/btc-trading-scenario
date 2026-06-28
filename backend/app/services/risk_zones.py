from __future__ import annotations

from app.schemas.candles import RiskZone, RiskZonesResponse
from app.schemas.market import CoinglassSnapshot, OrderbookHeatmapCell
from app.services.price_sanity import is_plausible_usd_price


class RiskZoneEstimator:
    """Estimate liquidation / squeeze zones from free derivatives + orderbook data."""

    def estimate(
        self,
        reference_price: float,
        coinglass: CoinglassSnapshot | None,
        heatmap_cells: list[OrderbookHeatmapCell] | None = None,
    ) -> RiskZonesResponse:
        if reference_price <= 0:
            return RiskZonesResponse(reference_price=0)

        funding = coinglass.funding_rate if coinglass else None
        ls_ratio = coinglass.long_short_ratio if coinglass else None
        if ls_ratio is None and coinglass and coinglass.exchanges:
            for ex in coinglass.exchanges:
                if ex.long_short_ratio is not None:
                    ls_ratio = ex.long_short_ratio
                    break

        long_liq: RiskZone | None = None
        short_sq: RiskZone | None = None

        liq_depth = 0.03
        if funding is not None and funding > 0.005:
            liq_depth = 0.04 + min(funding * 2, 0.03)
        if ls_ratio is not None and ls_ratio > 1.2:
            liq_depth += 0.01

        if liq_depth > 0:
            zone_low = round(reference_price * (1 - liq_depth - 0.02), 2)
            zone_high = round(reference_price * (1 - liq_depth * 0.5), 2)
            confidence = min(0.85, 0.45 + (funding or 0) * 10 + max(0, (ls_ratio or 1) - 1) * 0.2)
            long_liq = RiskZone(
                zone_low=zone_low,
                zone_high=zone_high,
                label="Long清算帯（推定）",
                rationale=(
                    f"Funding {(funding or 0) * 100:.3f}%・L/S {ls_ratio or '—'} をもとに、"
                    "ロング過多時の清算が集中しやすい下方帯を推定しています。"
                ),
                confidence=round(confidence, 2),
            )

        sq_depth = 0.03
        if funding is not None and funding < -0.005:
            sq_depth = 0.04 + min(abs(funding) * 2, 0.03)
        if ls_ratio is not None and ls_ratio < 0.85:
            sq_depth += 0.01

        if sq_depth > 0 and (funding is None or funding < 0.003):
            zone_low = round(reference_price * (1 + sq_depth * 0.5), 2)
            zone_high = round(reference_price * (1 + sq_depth + 0.02), 2)
            confidence = min(0.85, 0.45 + abs(funding or 0) * 10 + max(0, 1 - (ls_ratio or 1)) * 0.2)
            short_sq = RiskZone(
                zone_low=zone_low,
                zone_high=zone_high,
                label="ショートスクイズ帯（推定）",
                rationale=(
                    f"Funding {(funding or 0) * 100:.3f}%・L/S {ls_ratio or '—'} をもとに、"
                    "ショート過多時の踏み上げが起きやすい上方帯を推定しています。"
                ),
                confidence=round(confidence, 2),
            )

        if heatmap_cells and long_liq:
            bid_heavy = [c for c in heatmap_cells if c.bid_depth > c.ask_depth * 1.3]
            if bid_heavy:
                support_bin = min(c.price_bin for c in bid_heavy)
                if is_plausible_usd_price(support_bin, reference_price, min_ratio=0.85, max_ratio=1.0):
                    long_liq = long_liq.model_copy(
                        update={"zone_low": min(long_liq.zone_low, support_bin * 0.995)}
                    )

        if heatmap_cells and short_sq:
            ask_heavy = [c for c in heatmap_cells if c.ask_depth > c.bid_depth * 1.3]
            if ask_heavy:
                resist_bin = max(c.price_bin for c in ask_heavy)
                if is_plausible_usd_price(resist_bin, reference_price, min_ratio=1.0, max_ratio=1.15):
                    short_sq = short_sq.model_copy(
                        update={"zone_high": max(short_sq.zone_high, resist_bin * 1.005)}
                    )

        return RiskZonesResponse(
            reference_price=reference_price,
            long_liquidation=long_liq,
            short_squeeze=short_sq,
        )
