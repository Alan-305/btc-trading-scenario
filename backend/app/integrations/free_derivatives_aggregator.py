from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog

from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.integrations.binance_futures import BinanceFuturesClient
from app.integrations.bitget_futures import BitgetFuturesClient
from app.integrations.bybit_futures import BybitFuturesClient
from app.integrations.futures_base import BaseFuturesClient, ExchangeDerivativesRow
from app.integrations.okx_futures import OkxFuturesClient
from app.integrations.whitebit_futures import WhitebitFuturesClient
from app.schemas.market import CoinglassSnapshot, ExchangeDerivatives

logger = structlog.get_logger()

CLIENT_REGISTRY: dict[str, type[BaseFuturesClient]] = {
    "binance": BinanceFuturesClient,
    "bybit": BybitFuturesClient,
    "okx": OkxFuturesClient,
    "whitebit": WhitebitFuturesClient,
    "bitget": BitgetFuturesClient,
}


class FreeDerivativesAggregator:
    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    def _enabled_clients(self) -> list[BaseFuturesClient]:
        raw = self._settings.derivatives_exchanges or "binance,bybit,okx,whitebit"
        names = [n.strip().lower() for n in raw.split(",") if n.strip()]
        clients: list[BaseFuturesClient] = []
        for name in names:
            cls = CLIENT_REGISTRY.get(name)
            if cls:
                clients.append(cls(self.http))
        return clients

    async def fetch_snapshot(self) -> CoinglassSnapshot:
        clients = self._enabled_clients()

        async def safe_fetch(c: BaseFuturesClient) -> ExchangeDerivativesRow | None:
            try:
                return await c.fetch()
            except Exception as exc:
                logger.warning("derivatives_exchange_failed", exchange=c.exchange, error=str(exc))
                return None

        rows = [r for r in await asyncio.gather(*(safe_fetch(c) for c in clients)) if r is not None]
        exchanges = [
            ExchangeDerivatives(
                exchange=r.exchange,
                symbol=r.symbol,
                funding_rate=r.funding_rate,
                open_interest_usd=r.open_interest_usd,
                long_short_ratio=r.long_short_ratio,
                mark_price=r.mark_price,
                quote_currency=r.quote_currency or ("JPY" if r.exchange == "bitbank" else "USD"),
            )
            for r in rows
        ]

        # OI total across USD-margined venues
        oi_total = sum(e.open_interest_usd for e in exchanges if e.open_interest_usd)
        funding_vals = [e.funding_rate for e in exchanges if e.funding_rate is not None]
        ls_vals = [e.long_short_ratio for e in exchanges if e.long_short_ratio is not None]

        avg_funding = sum(funding_vals) / len(funding_vals) if funding_vals else None
        avg_ls = sum(ls_vals) / len(ls_vals) if ls_vals else None

        logger.info(
            "derivatives_aggregated",
            source="free_aggregate",
            exchanges=[e.exchange for e in exchanges],
            count=len(exchanges),
        )

        return CoinglassSnapshot(
            open_interest_usd=oi_total if oi_total > 0 else None,
            funding_rate=avg_funding,
            liquidation_24h_usd=None,
            long_short_ratio=avg_ls,
            source="free_aggregate",
            exchanges=exchanges,
            timestamp=datetime.now(timezone.utc),
        )
