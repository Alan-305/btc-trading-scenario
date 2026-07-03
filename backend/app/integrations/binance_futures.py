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
            account_ls, prev_24h, change_24h = await self._fetch_account_ratio_series(symbol)
            position_ls = await self._fetch_ratio(
                symbol, "globalLongShortPositionRatio"
            )
            top_ls = await self._fetch_ratio(symbol, "topLongShortAccountRatio")

            mark_price = float(premium.get("markPrice", 0) or 0)
            oi_btc = float(oi.get("openInterest", 0) or 0)
            oi_usd = oi_btc * mark_price if mark_price > 0 else None
            funding = float(premium.get("lastFundingRate", 0) or 0)

            return ExchangeDerivativesRow(
                exchange=self.exchange,
                symbol=symbol,
                funding_rate=funding,
                open_interest_usd=oi_usd,
                long_short_ratio=account_ls,
                long_short_position_ratio=position_ls,
                top_trader_long_short_ratio=top_ls,
                long_short_ratio_prev_24h=prev_24h,
                long_short_ratio_change_24h=change_24h,
                mark_price=mark_price,
            )
        except Exception:
            return None

    async def _fetch_ratio(self, symbol: str, endpoint: str) -> float | None:
        try:
            data = await self.http.get_json(
                f"{BASE}/futures/data/{endpoint}",
                params={"symbol": symbol, "period": "1h", "limit": 1},
                rate_limit_key="binance",
            )
            if data and isinstance(data, list) and len(data) > 0:
                return float(data[0].get("longShortRatio", 0) or 0)
        except Exception:
            pass
        return None

    async def _fetch_account_ratio_series(
        self, symbol: str
    ) -> tuple[float | None, float | None, float | None]:
        """Return (current, ~24h ago, change) from hourly account L/S history."""
        try:
            data = await self.http.get_json(
                f"{BASE}/futures/data/globalLongShortAccountRatio",
                params={"symbol": symbol, "period": "1h", "limit": 25},
                rate_limit_key="binance",
            )
            if not data or not isinstance(data, list):
                return None, None, None
            current = float(data[-1].get("longShortRatio", 0) or 0)
            prev = float(data[0].get("longShortRatio", 0) or 0) if len(data) >= 2 else None
            change = round(current - prev, 4) if prev is not None else None
            return current, prev, change
        except Exception:
            return None, None, None
