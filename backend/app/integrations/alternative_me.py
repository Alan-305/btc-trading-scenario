from datetime import datetime, timezone

from app.collectors.http_client import CollectorHttpClient
from app.schemas.market import FearGreedIndex

BASE = "https://api.alternative.me/fng/"


class AlternativeMeClient:
    def __init__(self, http: CollectorHttpClient):
        self.http = http

    async def fetch_fear_greed(self) -> FearGreedIndex | None:
        try:
            data = await self.http.get_json(BASE, params={"limit": 1}, rate_limit_key="alternative_me")
            row = data["data"][0]
            return FearGreedIndex(
                value=int(row["value"]),
                classification=str(row["value_classification"]),
                timestamp=datetime.fromtimestamp(int(row["timestamp"]), tz=timezone.utc),
            )
        except Exception:
            return None
