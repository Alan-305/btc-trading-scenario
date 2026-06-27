from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis

from app.config import get_settings
from app.schemas.market import MarketSnapshot


class RedisCache:
    MARKET_SNAPSHOT_KEY = "market:snapshot"
    FEAR_GREED_KEY = "indicators:fear_greed"
    COINGLASS_KEY = "indicators:coinglass"
    SCENARIO_KEY = "scenario:latest"

    def __init__(self, redis_url: str | None = None):
        settings = get_settings()
        self._url = redis_url or settings.redis_url
        self._ttl = settings.cache_ttl_seconds
        self._client: redis.Redis | None = None

    async def connect(self) -> None:
        if self._client is None:
            self._client = redis.from_url(self._url, decode_responses=True)

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def set_json(self, key: str, value: Any, ttl: int | None = None) -> None:
        await self.connect()
        assert self._client is not None
        await self._client.set(key, json.dumps(value, default=str), ex=ttl or self._ttl)

    async def get_json(self, key: str) -> Any | None:
        await self.connect()
        assert self._client is not None
        raw = await self._client.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    async def set_market_snapshot(self, snapshot: MarketSnapshot) -> None:
        await self.set_json(self.MARKET_SNAPSHOT_KEY, snapshot.model_dump(mode="json"))

    async def get_market_snapshot(self) -> MarketSnapshot | None:
        data = await self.get_json(self.MARKET_SNAPSHOT_KEY)
        if data is None:
            return None
        return MarketSnapshot.model_validate(data)
