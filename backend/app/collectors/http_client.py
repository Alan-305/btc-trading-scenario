import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.collectors.rate_limit import RateLimiterRegistry

logger = structlog.get_logger()


class CollectorHttpClient:
    def __init__(
        self,
        timeout: float = 10.0,
        rate_limiters: RateLimiterRegistry | None = None,
    ):
        self._client = httpx.AsyncClient(timeout=timeout)
        self._rate_limiters = rate_limiters or RateLimiterRegistry()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=0.5, max=4))
    async def get_json(
        self,
        url: str,
        *,
        params: dict | None = None,
        headers: dict | None = None,
        rate_limit_key: str | None = None,
    ):
        if rate_limit_key:
            await self._rate_limiters.get(rate_limit_key).acquire()

        resp = await self._client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        return resp.json()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=0.5, max=4))
    async def post_json(
        self,
        url: str,
        *,
        json: dict | None = None,
        headers: dict | None = None,
        rate_limit_key: str | None = None,
    ):
        if rate_limit_key:
            await self._rate_limiters.get(rate_limit_key).acquire()

        resp = await self._client.post(url, json=json, headers=headers)
        resp.raise_for_status()
        return resp.json()

    async def get_text(
        self,
        url: str,
        *,
        headers: dict | None = None,
        rate_limit_key: str | None = None,
    ) -> str:
        """Single-attempt fetch for rate-limited public feeds (no retry backoff)."""
        if rate_limit_key:
            await self._rate_limiters.get(rate_limit_key).acquire()

        resp = await self._client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.text

    async def aclose(self) -> None:
        await self._client.aclose()
