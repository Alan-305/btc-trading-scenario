from decimal import Decimal

from app.collectors.base import BaseCollector
from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.schemas.market import NormalizedOrderBook, NormalizedTicker, OrderBookLevel

BASE = "https://api.binance.com/api/v3"


class BinanceCollector(BaseCollector):
    exchange = "binance"

    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    def _default_symbol(self) -> str:
        return self._settings.binance_symbol

    async def fetch_ticker(self, symbol: str | None = None) -> NormalizedTicker:
        sym = symbol or self._default_symbol()
        data = await self.http.get_json(
            f"{BASE}/ticker/24hr",
            params={"symbol": sym},
            rate_limit_key="binance",
        )
        return NormalizedTicker(
            exchange="binance",
            symbol=sym,
            last_price=Decimal(str(data["lastPrice"])),
            bid=Decimal(str(data["bidPrice"])) if data.get("bidPrice") else None,
            ask=Decimal(str(data["askPrice"])) if data.get("askPrice") else None,
            volume_24h=Decimal(str(data.get("volume", 0))),
            quote_volume_24h=Decimal(str(data.get("quoteVolume", 0))),
            timestamp=self.utc_now(),
        )

    async def fetch_orderbook(
        self, symbol: str | None = None, limit: int = 50
    ) -> NormalizedOrderBook:
        sym = symbol or self._default_symbol()
        data = await self.http.get_json(
            f"{BASE}/depth",
            params={"symbol": sym, "limit": limit},
            rate_limit_key="binance",
        )
        return NormalizedOrderBook(
            exchange="binance",
            symbol=sym,
            bids=[OrderBookLevel(price=Decimal(p), size=Decimal(q)) for p, q in data["bids"]],
            asks=[OrderBookLevel(price=Decimal(p), size=Decimal(q)) for p, q in data["asks"]],
            timestamp=self.utc_now(),
        )
