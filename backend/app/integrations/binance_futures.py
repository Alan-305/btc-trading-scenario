from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.integrations.futures_base import BaseFuturesClient, ExchangeDerivativesRow

BASE = "https://fapi.binance.com"


class BinanceFuturesClient(BaseFuturesClient):
    exchange = "binance"

    def __init__(self, http: CollectorHttpClient):
        super().__init__(http)
        self._settings = get_settings()

    async def fetch(self) -> ExchangeDerivativesRow | None:
        symbol = self._settings.binance_symbol
        try:
            premium = await self.http.get_json(
                f"{BASE}/fapi/v1/premiumIndex",
                params={"symbol": symbol},
                rate_limit_key="binance",
            )
            oi = await self.http.get_json(
                f"{BASE}/fapi/v1/openInterest",
                params={"symbol": symbol},
                rate_limit_key="binance",
            )
            ls = await self._fetch_long_short_ratio(symbol)

            mark_price = float(premium.get("markPrice", 0) or 0)
            oi_btc = float(oi.get("openInterest", 0) or 0)
            oi_usd = oi_btc * mark_price if mark_price > 0 else None
            funding = float(premium.get("lastFundingRate", 0) or 0)

            return ExchangeDerivativesRow(
                exchange=self.exchange,
                symbol=symbol,
                funding_rate=funding,
                open_interest_usd=oi_usd,
                long_short_ratio=ls,
                mark_price=mark_price,
            )
        except Exception:
            return None

    async def _fetch_long_short_ratio(self, symbol: str) -> float | None:
        try:
            data = await self.http.get_json(
                f"{BASE}/futures/data/globalLongShortAccountRatio",
                params={"symbol": symbol, "period": "1h", "limit": 1},
                rate_limit_key="binance",
            )
            if data and isinstance(data, list) and len(data) > 0:
                return float(data[0].get("longShortRatio", 0) or 0)
        except Exception:
            pass
        return None
