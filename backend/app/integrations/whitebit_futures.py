from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.integrations.futures_base import BaseFuturesClient, ExchangeDerivativesRow

BASE = "https://whitebit.com/api/v4/public"


class WhitebitFuturesClient(BaseFuturesClient):
    exchange = "whitebit"

    def __init__(self, http: CollectorHttpClient):
        super().__init__(http)
        self._settings = get_settings()

    async def fetch(self) -> ExchangeDerivativesRow | None:
        market = self._settings.whitebit_futures_symbol
        try:
            data = await self.http.get_json(f"{BASE}/futures", rate_limit_key="whitebit")
            rows = data if isinstance(data, list) else data.get("result") or data.get("data") or []
            target = None
            for row in rows:
                name = row.get("ticker_id") or row.get("name") or row.get("market") or ""
                if name == market or market in str(name):
                    target = row
                    break
            if target is None and rows:
                # fallback: first BTC perpetual
                for row in rows:
                    tid = str(row.get("ticker_id") or row.get("name") or "")
                    if "BTC" in tid and "PERP" in tid:
                        target = row
                        market = tid
                        break

            if target is None:
                return None

            funding = float(target.get("funding_rate", 0) or 0)
            index_price = float(target.get("index_price", 0) or target.get("last_price", 0) or 0)
            oi_contracts = float(target.get("open_interest", 0) or 0)
            oi_usd = oi_contracts * index_price if index_price > 0 and oi_contracts > 0 else None

            return ExchangeDerivativesRow(
                exchange=self.exchange,
                symbol=market,
                funding_rate=funding,
                open_interest_usd=oi_usd,
                long_short_ratio=None,
                mark_price=index_price,
            )
        except Exception:
            return None
