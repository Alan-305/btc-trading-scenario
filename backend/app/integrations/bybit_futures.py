from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.integrations.futures_base import BaseFuturesClient, ExchangeDerivativesRow

BASE = "https://api.bybit.com/v5/market"


class BybitFuturesClient(BaseFuturesClient):
    exchange = "bybit"

    def __init__(self, http: CollectorHttpClient):
        super().__init__(http)
        self._settings = get_settings()

    async def fetch(self) -> ExchangeDerivativesRow | None:
        symbol = self._settings.bybit_futures_symbol
        try:
            data = await self.http.get_json(
                f"{BASE}/tickers",
                params={"category": "linear", "symbol": symbol},
                rate_limit_key="bybit",
            )
            rows = (data.get("result") or {}).get("list") or []
            if not rows:
                return None
            row = rows[0]
            mark = float(row.get("markPrice", 0) or row.get("lastPrice", 0) or 0)
            oi_contracts = float(row.get("openInterest", 0) or 0)
            # Bybit openInterest is in base coin (BTC) for linear
            oi_usd = oi_contracts * mark if mark > 0 else None
            funding = float(row.get("fundingRate", 0) or 0)

            return ExchangeDerivativesRow(
                exchange=self.exchange,
                symbol=symbol,
                funding_rate=funding,
                open_interest_usd=oi_usd,
                long_short_ratio=None,
                mark_price=mark,
            )
        except Exception:
            return None
