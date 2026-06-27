from __future__ import annotations

from datetime import datetime, timezone

from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.schemas.candles import Candle, CandleInterval

BASE = "https://fapi.binance.com"


class BinanceKlinesClient:
    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    async def fetch(
        self,
        interval: CandleInterval = "4h",
        limit: int = 100,
    ) -> list[Candle]:
        symbol = self._settings.binance_symbol
        raw = await self.http.get_json(
            f"{BASE}/fapi/v1/klines",
            params={"symbol": symbol, "interval": interval, "limit": limit},
            rate_limit_key="binance",
        )
        candles: list[Candle] = []
        for row in raw:
            candles.append(
                Candle(
                    ts=datetime.fromtimestamp(row[0] / 1000, tz=timezone.utc),
                    open=float(row[1]),
                    high=float(row[2]),
                    low=float(row[3]),
                    close=float(row[4]),
                    volume=float(row[5]),
                )
            )
        return candles
