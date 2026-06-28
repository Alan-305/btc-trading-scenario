from __future__ import annotations

import numpy as np

from app.schemas.market import NormalizedOrderBook, OrderbookHeatmapCell, VolumeProfileBin
from app.services.price_sanity import filter_usd_orderbooks


class VolumeProfileService:
    """Build a simple volume profile from order book depth."""

    def compute(
        self, orderbooks: list[NormalizedOrderBook], num_bins: int = 20
    ) -> list[VolumeProfileBin]:
        if not orderbooks:
            return []

        all_prices: list[float] = []
        for ob in orderbooks:
            for level in ob.bids + ob.asks:
                all_prices.append(float(level.price))

        if not all_prices:
            return []

        price_min = min(all_prices)
        price_max = max(all_prices)
        if price_max <= price_min:
            return []

        bin_edges = np.linspace(price_min, price_max, num_bins + 1)
        volumes = np.zeros(num_bins)

        for ob in orderbooks:
            for level in ob.bids + ob.asks:
                price = float(level.price)
                size = float(level.size)
                idx = int(np.digitize(price, bin_edges) - 1)
                idx = max(0, min(num_bins - 1, idx))
                volumes[idx] += size

        result: list[VolumeProfileBin] = []
        for i in range(num_bins):
            result.append(
                VolumeProfileBin(
                    price_low=float(bin_edges[i]),
                    price_high=float(bin_edges[i + 1]),
                    volume=float(volumes[i]),
                )
            )
        return result


class OrderbookHeatmapService:
    """Aggregate bid/ask depth into price bins for heatmap display."""

    def compute(
        self,
        orderbooks: list[NormalizedOrderBook],
        num_bins: int = 24,
        reference_price: float | None = None,
    ) -> list[OrderbookHeatmapCell]:
        orderbooks = filter_usd_orderbooks(orderbooks, reference_price)
        if not orderbooks:
            return []

        all_prices: list[float] = []
        for ob in orderbooks:
            for level in ob.bids + ob.asks:
                all_prices.append(float(level.price))

        if not all_prices:
            return []

        price_min = min(all_prices)
        price_max = max(all_prices)
        if price_max <= price_min:
            return []

        bin_edges = np.linspace(price_min, price_max, num_bins + 1)
        bid_depth = np.zeros(num_bins)
        ask_depth = np.zeros(num_bins)

        for ob in orderbooks:
            for level in ob.bids:
                price = float(level.price)
                idx = max(0, min(num_bins - 1, int(np.digitize(price, bin_edges) - 1)))
                bid_depth[idx] += float(level.size)
            for level in ob.asks:
                price = float(level.price)
                idx = max(0, min(num_bins - 1, int(np.digitize(price, bin_edges) - 1)))
                ask_depth[idx] += float(level.size)

        cells: list[OrderbookHeatmapCell] = []
        for i in range(num_bins):
            cells.append(
                OrderbookHeatmapCell(
                    price_bin=float((bin_edges[i] + bin_edges[i + 1]) / 2),
                    bid_depth=float(bid_depth[i]),
                    ask_depth=float(ask_depth[i]),
                )
            )
        return cells
