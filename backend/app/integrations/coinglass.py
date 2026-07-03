from datetime import datetime, timezone

from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.schemas.market import CoinglassSnapshot


class CoinglassClient:
    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    def _headers(self) -> dict[str, str]:
        return {
            "accept": "application/json",
            "CG-API-KEY": self._settings.coinglass_api_key,
        }

    async def fetch_snapshot(self) -> CoinglassSnapshot | None:
        if not self._settings.coinglass_api_key:
            return self._mock_snapshot()

        try:
            oi_data = await self.http.get_json(
                f"{self._settings.coinglass_base_url}/api/futures/open-interest/exchange-list",
                params={"symbol": "BTC"},
                headers=self._headers(),
                rate_limit_key="coinglass",
            )
            fr_data = await self.http.get_json(
                f"{self._settings.coinglass_base_url}/api/futures/funding-rate/exchange-list",
                params={"symbol": "BTC"},
                headers=self._headers(),
                rate_limit_key="coinglass",
            )

            oi_usd = None
            funding = None
            if oi_data.get("data"):
                oi_usd = float(oi_data["data"][0].get("openInterest", 0) or 0)
            if fr_data.get("data"):
                funding = float(fr_data["data"][0].get("rate", 0) or 0)

            return CoinglassSnapshot(
                open_interest_usd=oi_usd,
                funding_rate=funding,
                liquidation_24h_usd=None,
                long_short_ratio=None,
                long_short_signal="neutral",
                long_short_signal_ja="様子見",
                long_short_summary_ja="ロング／ショート比率のデータがありません。",
                long_short_stance="neutral",
                source="coinglass",
                exchanges=[],
                timestamp=datetime.now(timezone.utc),
            )
        except Exception:
            return self._mock_snapshot()

    def _mock_snapshot(self) -> CoinglassSnapshot:
        return CoinglassSnapshot(
            open_interest_usd=None,
            funding_rate=None,
            liquidation_24h_usd=None,
            long_short_ratio=None,
            long_short_signal="neutral",
            long_short_signal_ja="様子見",
            long_short_summary_ja="ロング／ショート比率のデータがありません。",
            long_short_stance="neutral",
            source=None,
            exchanges=[],
            timestamp=datetime.now(timezone.utc),
        )
