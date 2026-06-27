from datetime import datetime, timezone

import structlog

from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.integrations.coinglass import CoinglassClient
from app.integrations.free_derivatives_aggregator import FreeDerivativesAggregator
from app.schemas.market import CoinglassSnapshot

logger = structlog.get_logger()


class DerivativesProvider:
    """
    Derivatives market data with free-first strategy.

    - free: multi-exchange public APIs (Binance, Bybit, OKX, WhiteBIT)
    - coinglass: Coinglass API (paid key required)
    - auto: Coinglass if key is set, otherwise free aggregate
    """

    def __init__(self, http: CollectorHttpClient):
        self._settings = get_settings()
        self._coinglass = CoinglassClient(http)
        self._free = FreeDerivativesAggregator(http)

    def _mode(self) -> str:
        mode = (self._settings.derivatives_provider or "free").lower()
        if mode == "auto":
            return "coinglass" if self._settings.coinglass_api_key else "free"
        return mode

    async def fetch_snapshot(self) -> CoinglassSnapshot | None:
        mode = self._mode()

        if mode == "coinglass":
            snap = await self._coinglass.fetch_snapshot()
            if snap and snap.source is None:
                snap.source = "coinglass"
            return snap

        snap = await self._free.fetch_snapshot()
        if snap.exchanges:
            return snap

        logger.warning("derivatives_free_failed", fallback="empty")
        return CoinglassSnapshot(
            open_interest_usd=None,
            funding_rate=None,
            liquidation_24h_usd=None,
            long_short_ratio=None,
            source="none",
            exchanges=[],
            timestamp=datetime.now(timezone.utc),
        )
