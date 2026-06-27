from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.integrations.futures_base import BaseFuturesClient, ExchangeDerivativesRow

BASE = "https://public.bitbank.cc"


class BitbankMarketClient(BaseFuturesClient):
    """
    bitbank spot market data for the derivatives dashboard.

    bitbank does not offer a public perpetual/futures API.
    We expose spot price (JPY) and 24h volume as reference alongside futures venues.
    """

    exchange = "bitbank"

    def __init__(self, http: CollectorHttpClient):
        super().__init__(http)
        self._settings = get_settings()

    async def fetch(self) -> ExchangeDerivativesRow | None:
        sym = self._settings.bitbank_symbol
        try:
            data = await self.http.get_json(f"{BASE}/{sym}/ticker", rate_limit_key="bitbank")
            row = data["data"]
            last_jpy = float(row["last"])
            vol_btc = float(row.get("vol", 0) or 0)
            # Notional volume in JPY (liquidity proxy; not open interest)
            notional_jpy = last_jpy * vol_btc if last_jpy > 0 and vol_btc > 0 else None

            return ExchangeDerivativesRow(
                exchange=self.exchange,
                symbol=sym,
                funding_rate=None,
                open_interest_usd=notional_jpy,
                long_short_ratio=None,
                mark_price=last_jpy,
                quote_currency="JPY",
            )
        except Exception:
            return None
