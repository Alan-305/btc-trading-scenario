from __future__ import annotations

import json
import time
from typing import Any, Literal

import redis.asyncio as redis
import structlog

from app.config import get_settings
from app.schemas.market import MarketSnapshot

logger = structlog.get_logger()

CacheBackend = Literal["auto", "memory", "redis"]


class MemoryCache:
    def __init__(self, default_ttl: int = 60):
        self._store: dict[str, tuple[str, float | None]] = {}
        self._default_ttl = default_ttl

    async def set_json(self, key: str, value: Any, ttl: int | None = None) -> None:
        expires = time.time() + (ttl or self._default_ttl) if (ttl or self._default_ttl) else None
        self._store[key] = (json.dumps(value, default=str), expires)

    async def get_json(self, key: str) -> Any | None:
        row = self._store.get(key)
        if row is None:
            return None
        raw, expires = row
        if expires is not None and time.time() > expires:
            del self._store[key]
            return None
        return json.loads(raw)


class RedisCache:
    MARKET_SNAPSHOT_KEY = "market:snapshot"
    FEAR_GREED_KEY = "indicators:fear_greed"
    COINGLASS_KEY = "indicators:coinglass"
    SCENARIO_KEY = "scenario:latest"
    MACRO_EVENTS_KEY = "indicators:macro_events"

    def __init__(self, redis_url: str | None = None, default_ttl: int | None = None):
        settings = get_settings()
        self._url = redis_url or settings.redis_url
        self._ttl = default_ttl or settings.cache_ttl_seconds
        self._client: redis.Redis | None = None

    async def connect(self) -> None:
        if self._client is None:
            self._client = redis.from_url(self._url, decode_responses=True)

    async def ping(self) -> bool:
        await self.connect()
        assert self._client is not None
        await self._client.ping()
        return True

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


class AppCache:
    """Unified cache: memory, redis, or auto-fallback when Redis is unavailable."""

    MARKET_SNAPSHOT_KEY = RedisCache.MARKET_SNAPSHOT_KEY
    FEAR_GREED_KEY = RedisCache.FEAR_GREED_KEY
    COINGLASS_KEY = RedisCache.COINGLASS_KEY
    SCENARIO_KEY = RedisCache.SCENARIO_KEY
    MACRO_EVENTS_KEY = RedisCache.MACRO_EVENTS_KEY

    def __init__(self) -> None:
        settings = get_settings()
        self._backend: CacheBackend = settings.cache_backend  # type: ignore[assignment]
        self._memory = MemoryCache(settings.cache_ttl_seconds)
        self._redis = RedisCache()
        self._using_memory = self._backend == "memory"
        self._redis_checked = False

    async def _active(self) -> MemoryCache | RedisCache:
        if self._backend == "memory" or self._using_memory:
            return self._memory
        if self._backend == "redis":
            return self._redis
        # auto: try redis once, fall back to memory
        if not self._redis_checked:
            self._redis_checked = True
            try:
                await self._redis.ping()
                logger.info("cache_backend", backend="redis")
            except Exception as exc:
                self._using_memory = True
                logger.warning("cache_redis_unavailable", fallback="memory", error=str(exc))
        return self._memory if self._using_memory else self._redis

    async def set_json(self, key: str, value: Any, ttl: int | None = None) -> None:
        backend = await self._active()
        await backend.set_json(key, value, ttl=ttl)

    async def get_json(self, key: str) -> Any | None:
        backend = await self._active()
        return await backend.get_json(key)

    async def set_market_snapshot(self, snapshot: MarketSnapshot) -> None:
        await self.set_json(self.MARKET_SNAPSHOT_KEY, snapshot.model_dump(mode="json"))

    async def get_market_snapshot(self) -> MarketSnapshot | None:
        data = await self.get_json(self.MARKET_SNAPSHOT_KEY)
        if data is None:
            return None
        return MarketSnapshot.model_validate(data)
