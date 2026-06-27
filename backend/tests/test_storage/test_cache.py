import pytest

from app.storage.redis_cache import AppCache, MemoryCache


@pytest.mark.asyncio
async def test_memory_cache_ttl():
    cache = MemoryCache(default_ttl=1)
    await cache.set_json("k", {"a": 1})
    assert await cache.get_json("k") == {"a": 1}


@pytest.mark.asyncio
async def test_app_cache_memory_backend(monkeypatch):
    monkeypatch.setenv("CACHE_BACKEND", "memory")
    from app.config import get_settings

    get_settings.cache_clear()

    cache = AppCache()
    await cache.set_json("test", {"ok": True})
    assert await cache.get_json("test") == {"ok": True}

    get_settings.cache_clear()
