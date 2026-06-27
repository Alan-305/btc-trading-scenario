from abc import ABC, abstractmethod
from datetime import datetime, timezone

from app.schemas.market import NormalizedOrderBook, NormalizedTicker


class BaseCollector(ABC):
    exchange: str

    @abstractmethod
    async def fetch_ticker(self, symbol: str | None = None) -> NormalizedTicker: ...

    @abstractmethod
    async def fetch_orderbook(
        self, symbol: str | None = None, limit: int = 50
    ) -> NormalizedOrderBook: ...

    @staticmethod
    def utc_now() -> datetime:
        return datetime.now(timezone.utc)
