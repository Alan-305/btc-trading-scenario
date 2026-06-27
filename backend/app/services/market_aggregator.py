from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog

from app.collectors.base import BaseCollector
from app.schemas.market import MarketSnapshot, NormalizedOrderBook, NormalizedTicker

logger = structlog.get_logger()


class MarketAggregator:
    def __init__(self, collectors: list[BaseCollector]):
        self.collectors = collectors

    async def collect_all(self, include_orderbooks: bool = True) -> MarketSnapshot:
        async def safe_ticker(c: BaseCollector) -> NormalizedTicker | None:
            try:
                return await c.fetch_ticker()
            except Exception as exc:
                logger.warning("ticker_fetch_failed", exchange=c.exchange, error=str(exc))
                return None

        async def safe_orderbook(c: BaseCollector) -> NormalizedOrderBook | None:
            try:
                return await c.fetch_orderbook()
            except Exception as exc:
                logger.warning("orderbook_fetch_failed", exchange=c.exchange, error=str(exc))
                return None

        ticker_tasks = [safe_ticker(c) for c in self.collectors]
        tickers = [t for t in await asyncio.gather(*ticker_tasks) if t is not None]

        orderbooks: list[NormalizedOrderBook] = []
        if include_orderbooks:
            ob_tasks = [safe_orderbook(c) for c in self.collectors]
            orderbooks = [o for o in await asyncio.gather(*ob_tasks) if o is not None]

        return MarketSnapshot(
            tickers=tickers,
            orderbooks=orderbooks,
            divergence_pct={},
            collected_at=datetime.now(timezone.utc),
        )
