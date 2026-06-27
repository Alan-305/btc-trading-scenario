from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.integrations.futures_base import BaseFuturesClient, ExchangeDerivativesRow

BASE = "https://www.okx.com/api/v5/public"


class OkxFuturesClient(BaseFuturesClient):
    exchange = "okx"

    def __init__(self, http: CollectorHttpClient):
        super().__init__(http)
        self._settings = get_settings()

    async def fetch(self) -> ExchangeDerivativesRow | None:
        inst_id = self._settings.okx_futures_symbol
        try:
            funding_data = await self.http.get_json(
                f"{BASE}/funding-rate",
                params={"instId": inst_id},
                rate_limit_key="okx",
            )
            oi_data = await self.http.get_json(
                f"{BASE}/open-interest",
                params={"instType": "SWAP", "instId": inst_id},
                rate_limit_key="okx",
            )
            mark_data = await self.http.get_json(
                "https://www.okx.com/api/v5/market/ticker",
                params={"instId": inst_id},
                rate_limit_key="okx",
            )

            funding_rows = funding_data.get("data") or []
            oi_rows = oi_data.get("data") or []
            mark_rows = mark_data.get("data") or []

            funding = float(funding_rows[0].get("fundingRate", 0) or 0) if funding_rows else None
            mark = float(mark_rows[0].get("last", 0) or 0) if mark_rows else None

            oi_usd = None
            if oi_rows:
                row = oi_rows[0]
                # oiCcy is notional in quote (USDT) on OKX
                if row.get("oiCcy"):
                    oi_usd = float(row["oiCcy"])
                elif row.get("oi") and mark:
                    oi_usd = float(row["oi"]) * mark

            return ExchangeDerivativesRow(
                exchange=self.exchange,
                symbol=inst_id,
                funding_rate=funding,
                open_interest_usd=oi_usd,
                long_short_ratio=None,
                mark_price=mark,
            )
        except Exception:
            return None
