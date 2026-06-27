from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.collectors.http_client import CollectorHttpClient


@dataclass
class ExchangeDerivativesRow:
    exchange: str
    symbol: str
    funding_rate: float | None = None
    open_interest_usd: float | None = None
    long_short_ratio: float | None = None
    mark_price: float | None = None
    quote_currency: str | None = None


class BaseFuturesClient:
    exchange: str

    def __init__(self, http: CollectorHttpClient):
        self.http = http

    async def fetch(self) -> ExchangeDerivativesRow | None:
        raise NotImplementedError

    @staticmethod
    def utc_now() -> datetime:
        return datetime.now(timezone.utc)
