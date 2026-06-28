import asyncio
import time


class TokenBucketRateLimiter:
    """Simple per-exchange rate limiter."""

    def __init__(self, rate_per_second: float):
        self._interval = 1.0 / rate_per_second
        self._lock = asyncio.Lock()
        self._last_call = 0.0

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            wait = self._interval - (now - self._last_call)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_call = time.monotonic()


EXCHANGE_RATE_LIMITS: dict[str, float] = {
    "whitebit": 5.0,
    "bybit": 5.0,
    "okx": 5.0,
    "binance": 10.0,
    "bitget": 5.0,
    "coinbase": 5.0,
    "deribit": 5.0,
    "yahoo": 2.0,
    "blockchain": 1.0,
    "mempool": 2.0,
    "coinglass": 2.0,
    "alternative_me": 1.0,
}


class RateLimiterRegistry:
    def __init__(self) -> None:
        self._limiters: dict[str, TokenBucketRateLimiter] = {}

    def get(self, name: str) -> TokenBucketRateLimiter:
        if name not in self._limiters:
            rate = EXCHANGE_RATE_LIMITS.get(name, 2.0)
            self._limiters[name] = TokenBucketRateLimiter(rate)
        return self._limiters[name]
