from __future__ import annotations

from app.integrations.okx_liquidations import OkxLiquidationClient
from app.schemas.liquidation import LiquidationEvent
from app.storage.redis_cache import AppCache


class LiquidationFeed:
    CACHE_KEY = "liquidation:okx:btc"
    CACHE_TTL = 60

    def __init__(self, okx: OkxLiquidationClient, cache: AppCache | None = None):
        self._okx = okx
        self._cache = cache or AppCache()

    async def fetch_recent(self) -> list[LiquidationEvent]:
        cached = await self._cache.get_json(self.CACHE_KEY)
        if cached and isinstance(cached, list):
            return [LiquidationEvent.model_validate(row) for row in cached]

        events = await self._okx.fetch_recent(limit=100)
        if events:
            await self._cache.set_json(
                self.CACHE_KEY,
                [e.model_dump(mode="json") for e in events],
                ttl=self.CACHE_TTL,
            )
        return events
