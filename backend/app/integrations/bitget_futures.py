from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.integrations.futures_base import BaseFuturesClient, ExchangeDerivativesRow

BASE = "https://api.bitget.com/api/v2/mix/market"


class BitgetFuturesClient(BaseFuturesClient):
    exchange = "bitget"

    def __init__(self, http: CollectorHttpClient):
        super().__init__(http)
        self._settings = get_settings()

    async def fetch(self) -> ExchangeDerivativesRow | None:
        symbol = self._settings.bitget_futures_symbol
        try:
            data = await self.http.get_json(
                f"{BASE}/ticker",
                params={"productType": "USDT-FUTURES", "symbol": symbol},
                rate_limit_key="bitget",
            )
            rows = data.get("data") or []
            if not rows:
                return None
            row = rows[0]
            mark = float(row.get("markPrice", 0) or row.get("lastPr", 0) or 0)
            oi_base = float(row.get("holdingAmount", 0) or row.get("openInterest", 0) or 0)
            oi_usd = oi_base * mark if mark > 0 and oi_base > 0 else None
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
