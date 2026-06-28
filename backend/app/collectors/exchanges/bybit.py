from decimal import Decimal

from app.collectors.base import BaseCollector
from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.schemas.market import NormalizedOrderBook, NormalizedTicker, OrderBookLevel

BASE = "https://api.bybit.com/v5/market"


class BybitCollector(BaseCollector):
    exchange = "bybit"

    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    def _default_symbol(self) -> str:
        return self._settings.bybit_spot_symbol

    async def fetch_ticker(self, symbol: str | None = None) -> NormalizedTicker:
        sym = symbol or self._default_symbol()
        data = await self.http.get_json(
            f"{BASE}/tickers",
            params={"category": "spot", "symbol": sym},
            rate_limit_key="bybit",
        )
        rows = (data.get("result") or {}).get("list") or []
        if not rows:
            raise RuntimeError("bybit ticker empty")
        row = rows[0]
        return NormalizedTicker(
            exchange="bybit",
            symbol=sym,
            last_price=Decimal(str(row.get("lastPrice", 0))),
            bid=Decimal(str(row["bid1Price"])) if row.get("bid1Price") else None,
            ask=Decimal(str(row["ask1Price"])) if row.get("ask1Price") else None,
            volume_24h=Decimal(str(row.get("volume24h", 0) or 0)),
            quote_volume_24h=Decimal(str(row.get("turnover24h", 0) or 0)),
            timestamp=self.utc_now(),
        )

    async def fetch_orderbook(
        self, symbol: str | None = None, limit: int = 50
    ) -> NormalizedOrderBook:
        sym = symbol or self._default_symbol()
        data = await self.http.get_json(
            f"{BASE}/orderbook",
            params={"category": "spot", "symbol": sym, "limit": limit},
            rate_limit_key="bybit",
        )
        result = data.get("result") or {}
        return NormalizedOrderBook(
            exchange="bybit",
            symbol=sym,
            bids=[
                OrderBookLevel(price=Decimal(p), size=Decimal(q))
                for p, q in (result.get("b") or [])[:limit]
            ],
            asks=[
                OrderBookLevel(price=Decimal(p), size=Decimal(q))
                for p, q in (result.get("a") or [])[:limit]
            ],
            timestamp=self.utc_now(),
        )
