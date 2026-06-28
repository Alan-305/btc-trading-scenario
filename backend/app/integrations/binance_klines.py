from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.schemas.candles import Candle, CandleInterval

BASE = "https://fapi.binance.com"
_MAX_KLINES_PER_REQUEST = 1500


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
        return self._parse_rows(raw)

    async def fetch_range(
        self,
        start: datetime,
        end: datetime,
        interval: CandleInterval = "1h",
    ) -> list[Candle]:
        """start〜end のローソク足を取得（Binance startTime/endTime）。"""
        symbol = self._settings.binance_symbol
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        start_ms = int(start.timestamp() * 1000)
        end_ms = int(end.timestamp() * 1000)
        raw = await self.http.get_json(
            f"{BASE}/fapi/v1/klines",
            params={
                "symbol": symbol,
                "interval": interval,
                "startTime": start_ms,
                "endTime": end_ms,
                "limit": 1500,
            },
            rate_limit_key="binance",
        )
        return self._parse_rows(raw)

    async def fetch_range_paginated(
        self,
        start: datetime,
        end: datetime,
        interval: CandleInterval = "1h",
    ) -> list[Candle]:
        """start〜end のローソク足をページング取得。"""
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        all_candles: list[Candle] = []
        cursor = start
        while cursor < end:
            batch = await self.fetch_range(cursor, end, interval=interval)
            if not batch:
                break
            all_candles.extend(batch)
            if len(batch) < _MAX_KLINES_PER_REQUEST:
                break
            last_ts = batch[-1].ts
            if last_ts >= end:
                break
            cursor = last_ts + timedelta(hours=1)

        return all_candles

    @staticmethod
    def _parse_rows(raw: list) -> list[Candle]:
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
