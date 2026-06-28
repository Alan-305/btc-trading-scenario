from __future__ import annotations

from datetime import datetime, timezone

import structlog

from app.collectors.http_client import CollectorHttpClient
from app.schemas.extended_market import OnChainSnapshot

logger = structlog.get_logger()

BLOCKCHAIN_CHART = "https://api.blockchain.info/charts/{chart}"
MEMPOOL_FEES = "https://mempool.space/api/v1/fees/recommended"


class OnChainMetricsClient:
    def __init__(self, http: CollectorHttpClient):
        self.http = http

    async def fetch_snapshot(self) -> OnChainSnapshot | None:
        try:
            hash_vals = await self._chart_values("hash-rate", days=14)
            tx_vals = await self._chart_values("n-transactions", days=14)
            vol_vals = await self._chart_values("trade-volume", days=14)
            fees = await self._mempool_fees()

            hash_rate = hash_vals[-1]["y"] if hash_vals else None
            hash_change = _pct_change(hash_vals, window=7)
            tx_24h = tx_vals[-1]["y"] if tx_vals else None
            trade_vol = vol_vals[-1]["y"] if vol_vals else None
            activity = _activity_trend(tx_vals)

            return OnChainSnapshot(
                hash_rate_th_s=round(hash_rate, 2) if hash_rate is not None else None,
                hash_rate_change_7d_pct=hash_change,
                tx_count_24h=round(tx_24h, 0) if tx_24h is not None else None,
                trade_volume_usd=round(trade_vol, 0) if trade_vol is not None else None,
                mempool_fast_fee_sat=fees,
                activity_trend=activity,
                source="blockchain.info+mempool.space",
                timestamp=datetime.now(timezone.utc),
            )
        except Exception as exc:
            logger.warning("onchain_metrics_failed", error=str(exc))
            return None

    async def _chart_values(self, chart: str, days: int) -> list[dict]:
        data = await self.http.get_json(
            BLOCKCHAIN_CHART.format(chart=chart),
            params={"timespan": f"{days}days", "format": "json", "sampled": "true"},
            rate_limit_key="blockchain",
        )
        return data.get("values") or []

    async def _mempool_fees(self) -> int | None:
        try:
            data = await self.http.get_json(MEMPOOL_FEES, rate_limit_key="mempool")
            fee = data.get("fastestFee")
            return int(fee) if fee is not None else None
        except Exception:
            return None


def _pct_change(values: list[dict], window: int) -> float | None:
    if len(values) < window + 1:
        return None
    recent = float(values[-1]["y"])
    prior = float(values[-1 - window]["y"])
    if prior <= 0:
        return None
    return round((recent - prior) / prior * 100, 2)


def _activity_trend(values: list[dict]) -> str:
    if len(values) < 8:
        return "stable"
    recent_avg = sum(float(v["y"]) for v in values[-3:]) / 3
    prior_avg = sum(float(v["y"]) for v in values[-7:-3]) / 4
    if prior_avg <= 0:
        return "stable"
    change = (recent_avg - prior_avg) / prior_avg
    if change > 0.05:
        return "rising"
    if change < -0.05:
        return "falling"
    return "stable"
