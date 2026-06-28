from __future__ import annotations

from datetime import datetime, timezone

import structlog

from app.collectors.http_client import CollectorHttpClient
from app.config import get_settings
from app.schemas.liquidation import LiquidationEvent

logger = structlog.get_logger()

BASE = "https://www.okx.com/api/v5/public/liquidation-orders"


class OkxLiquidationClient:
    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._settings = get_settings()

    async def fetch_recent(self, *, limit: int = 100) -> list[LiquidationEvent]:
        inst_id = self._settings.okx_futures_symbol
        uly = "BTC-USDT"
        if inst_id.startswith("BTC"):
            uly = "BTC-USDT"

        try:
            data = await self.http.get_json(
                BASE,
                params={
                    "instType": "SWAP",
                    "uly": uly,
                    "state": "filled",
                    "limit": str(min(limit, 100)),
                },
                rate_limit_key="okx",
            )
        except Exception as exc:
            logger.warning("okx_liquidation_fetch_failed", error=str(exc))
            return []

        if data.get("code") != "0":
            return []

        events: list[LiquidationEvent] = []
        for row in data.get("data") or []:
            for detail in row.get("details") or []:
                parsed = self._parse_detail(detail, inst_id)
                if parsed:
                    events.append(parsed)
        return events

    def _parse_detail(self, detail: dict, symbol: str) -> LiquidationEvent | None:
        pos_side = (detail.get("posSide") or "").lower()
        if pos_side not in ("long", "short"):
            return None

        try:
            price = float(detail.get("bkPx") or 0)
            size = float(detail.get("sz") or 0)
        except (TypeError, ValueError):
            return None

        if price <= 0 or size <= 0:
            return None

        ts_raw = detail.get("ts") or detail.get("time")
        try:
            ts_ms = int(ts_raw)
            timestamp = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
        except (TypeError, ValueError):
            timestamp = datetime.now(timezone.utc)

        return LiquidationEvent(
            exchange="okx",
            symbol=symbol,
            position_side=pos_side,  # type: ignore[arg-type]
            price=round(price, 2),
            notional_usd=round(price * size, 2),
            timestamp=timestamp,
        )
