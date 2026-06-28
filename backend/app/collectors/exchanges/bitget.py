from decimal import Decimal

from app.collectors.base import BaseCollector
from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.schemas.market import NormalizedOrderBook, NormalizedTicker, OrderBookLevel

BASE = "https://api.bitget.com/api/v2/spot/market"


class BitgetCollector(BaseCollector):
    exchange = "bitget"

    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    def _default_symbol(self) -> str:
        return self._settings.bitget_symbol

    async def fetch_ticker(self, symbol: str | None = None) -> NormalizedTicker:
        sym = symbol or self._default_symbol()
        data = await self.http.get_json(
            f"{BASE}/tickers",
            params={"symbol": sym},
            rate_limit_key="bitget",
        )
        rows = data.get("data") or []
        if not rows:
            raise RuntimeError("bitget ticker empty")
        row = rows[0]
        return NormalizedTicker(
            exchange="bitget",
            symbol=sym,
            last_price=Decimal(str(row.get("lastPr", 0))),
            bid=Decimal(str(row["bidPr"])) if row.get("bidPr") else None,
            ask=Decimal(str(row["askPr"])) if row.get("askPr") else None,
            volume_24h=Decimal(str(row.get("baseVolume", 0) or 0)),
            quote_volume_24h=Decimal(str(row.get("quoteVolume", 0) or 0)),
            timestamp=self.utc_now(),
        )

    async def fetch_orderbook(
        self, symbol: str | None = None, limit: int = 50
    ) -> NormalizedOrderBook:
        sym = symbol or self._default_symbol()
        data = await self.http.get_json(
            f"{BASE}/orderbook",
            params={"symbol": sym, "type": "step0", "limit": limit},
            rate_limit_key="bitget",
        )
        book = (data.get("data") or {})
        return NormalizedOrderBook(
            exchange="bitget",
            symbol=sym,
            bids=[
                OrderBookLevel(price=Decimal(p), size=Decimal(q))
                for p, q in (book.get("bids") or [])[:limit]
            ],
            asks=[
                OrderBookLevel(price=Decimal(p), size=Decimal(q))
                for p, q in (book.get("asks") or [])[:limit]
            ],
            timestamp=self.utc_now(),
        )
