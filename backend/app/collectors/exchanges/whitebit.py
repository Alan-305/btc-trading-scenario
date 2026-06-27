from decimal import Decimal

from app.collectors.base import BaseCollector
from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.schemas.market import NormalizedOrderBook, NormalizedTicker, OrderBookLevel

BASE = "https://whitebit.com/api/v4/public"


class WhitebitCollector(BaseCollector):
    exchange = "whitebit"

    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    def _default_symbol(self) -> str:
        return self._settings.whitebit_symbol

    async def fetch_ticker(self, symbol: str | None = None) -> NormalizedTicker:
        sym = symbol or self._default_symbol()
        data = await self.http.get_json(
            f"{BASE}/ticker",
            params={"market": sym},
            rate_limit_key="whitebit",
        )
        row = data[sym] if isinstance(data, dict) and sym in data else data
        return NormalizedTicker(
            exchange="whitebit",
            symbol=sym,
            last_price=Decimal(str(row["last_price"])),
            bid=Decimal(str(row["bid"])) if row.get("bid") else None,
            ask=Decimal(str(row["ask"])) if row.get("ask") else None,
            volume_24h=Decimal(str(row.get("base_volume", 0))),
            quote_volume_24h=Decimal(str(row.get("quote_volume", 0))),
            timestamp=self.utc_now(),
        )

    async def fetch_orderbook(
        self, symbol: str | None = None, limit: int = 50
    ) -> NormalizedOrderBook:
        sym = symbol or self._default_symbol()
        data = await self.http.get_json(
            f"{BASE}/orderbook/{sym}",
            params={"limit": limit},
            rate_limit_key="whitebit",
        )
        return NormalizedOrderBook(
            exchange="whitebit",
            symbol=sym,
            bids=[OrderBookLevel(price=Decimal(p), size=Decimal(q)) for p, q in data["bids"]],
            asks=[OrderBookLevel(price=Decimal(p), size=Decimal(q)) for p, q in data["asks"]],
            timestamp=self.utc_now(),
        )
