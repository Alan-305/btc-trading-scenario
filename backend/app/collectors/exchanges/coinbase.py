from decimal import Decimal

from app.collectors.base import BaseCollector
from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.schemas.market import NormalizedOrderBook, NormalizedTicker, OrderBookLevel

BASE = "https://api.exchange.coinbase.com"


class CoinbaseCollector(BaseCollector):
    exchange = "coinbase"

    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    def _default_symbol(self) -> str:
        return self._settings.coinbase_symbol

    async def fetch_ticker(self, symbol: str | None = None) -> NormalizedTicker:
        sym = symbol or self._default_symbol()
        product_id = sym.replace("_", "-")
        data = await self.http.get_json(
            f"{BASE}/products/{product_id}/ticker",
            rate_limit_key="coinbase",
        )
        return NormalizedTicker(
            exchange="coinbase",
            symbol=product_id,
            last_price=Decimal(str(data["price"])),
            bid=Decimal(str(data["bid"])) if data.get("bid") else None,
            ask=Decimal(str(data["ask"])) if data.get("ask") else None,
            volume_24h=Decimal(str(data.get("volume", 0))),
            quote_volume_24h=None,
            timestamp=self.utc_now(),
        )

    async def fetch_orderbook(
        self, symbol: str | None = None, limit: int = 50
    ) -> NormalizedOrderBook:
        sym = symbol or self._default_symbol()
        product_id = sym.replace("_", "-")
        data = await self.http.get_json(
            f"{BASE}/products/{product_id}/book",
            params={"level": 2},
            rate_limit_key="coinbase",
        )
        bids_raw = data["bids"][:limit]
        asks_raw = data["asks"][:limit]
        return NormalizedOrderBook(
            exchange="coinbase",
            symbol=product_id,
            bids=[
                OrderBookLevel(price=Decimal(p), size=Decimal(q)) for p, q, *_ in bids_raw
            ],
            asks=[
                OrderBookLevel(price=Decimal(p), size=Decimal(q)) for p, q, *_ in asks_raw
            ],
            timestamp=self.utc_now(),
        )
