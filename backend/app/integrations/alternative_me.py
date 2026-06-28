from datetime import datetime, timezone

from app.collectors.http_client import CollectorHttpClient
from typing import Literal, cast

from app.schemas.market import FearGreedHistoryPoint, FearGreedIndex, FearGreedIndicators

BASE = "https://api.alternative.me/fng/"

_HISTORY_PERIODS: tuple[tuple[str, str, int], ...] = (
    ("now", "現在", 0),
    ("yesterday", "昨日", 1),
    ("last_week", "先週", 7),
    ("last_month", "先月", 30),
)


class AlternativeMeClient:
    def __init__(self, http: CollectorHttpClient):
        self.http = http

    async def fetch_fear_greed(self) -> FearGreedIndex | None:
        indicators = await self.fetch_fear_greed_indicators()
        return indicators.current if indicators else None

    async def fetch_fear_greed_indicators(self) -> FearGreedIndicators | None:
        try:
            data = await self.http.get_json(
                BASE,
                params={"limit": 31},
                rate_limit_key="alternative_me",
            )
            rows = data.get("data") or []
            if not rows:
                return None

            current = self._row_to_index(rows[0])
            history: list[FearGreedHistoryPoint] = []
            for period, label_ja, offset in _HISTORY_PERIODS:
                row = rows[min(offset, len(rows) - 1)]
                history.append(
                    FearGreedHistoryPoint(
                        period=cast(Literal["now", "yesterday", "last_week", "last_month"], period),
                        label_ja=label_ja,
                        value=int(row["value"]),
                        classification=str(row["value_classification"]),
                    )
                )

            return FearGreedIndicators(current=current, history=history)
        except Exception:
            return None

    @staticmethod
    def _row_to_index(row: dict) -> FearGreedIndex:
        return FearGreedIndex(
            value=int(row["value"]),
            classification=str(row["value_classification"]),
            timestamp=datetime.fromtimestamp(int(row["timestamp"]), tz=timezone.utc),
        )
