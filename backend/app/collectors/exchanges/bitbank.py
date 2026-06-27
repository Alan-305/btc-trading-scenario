from decimal import Decimal

from app.collectors.base import BaseCollector
from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.schemas.market import NormalizedOrderBook, NormalizedTicker, OrderBookLevel

BASE = "https://public.bitbank.cc"


class BitbankCollector(BaseCollector):
    exchange = "bitbank"

    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    def _default_symbol(self) -> str:
        return self._settings.bitbank_symbol

    async def fetch_ticker(self, symbol: str | None = None) -> NormalizedTicker:
        sym = symbol or self._default_symbol()
        data = await self.http.get_json(
            f"{BASE}/{sym}/ticker",
            rate_limit_key="bitbank",
        )
        row = data["data"]
        return NormalizedTicker(
            exchange="bitbank",
            symbol=sym,
            last_price=Decimal(str(row["last"])),
            bid=Decimal(str(row["buy"])) if row.get("buy") else None,
            ask=Decimal(str(row["sell"])) if row.get("sell") else None,
            volume_24h=Decimal(str(row.get("vol", 0))),
            quote_volume_24h=None,
            timestamp=self.utc_now(),
        )

    async def fetch_orderbook(
        self, symbol: str | None = None, limit: int = 50
    ) -> NormalizedOrderBook:
        sym = symbol or self._default_symbol()
        data = await self.http.get_json(
            f"{BASE}/{sym}/depth",
            rate_limit_key="bitbank",
        )
        row = data["data"]
        bids = row["bids"][:limit]
        asks = row["asks"][:limit]
        return NormalizedOrderBook(
            exchange="bitbank",
            symbol=sym,
            bids=[OrderBookLevel(price=Decimal(p[0]), size=Decimal(p[1])) for p in bids],
            asks=[OrderBookLevel(price=Decimal(p[0]), size=Decimal(p[1])) for p in asks],
            timestamp=self.utc_now(),
        )
