from __future__ import annotations

from datetime import datetime, timezone

import structlog

from app.collectors.http_client import CollectorHttpClient
from app.schemas.extended_market import BtcOptionsSnapshot, MacroSeriesPoint

logger = structlog.get_logger()

BASE = "https://www.deribit.com/api/v2/public"


class DeribitOptionsClient:
    def __init__(self, http: CollectorHttpClient):
        self.http = http

    async def fetch_snapshot(self) -> BtcOptionsSnapshot | None:
        try:
            data = await self.http.get_json(
                f"{BASE}/get_book_summary_by_currency",
                params={"currency": "BTC", "kind": "option"},
                rate_limit_key="deribit",
            )
            rows = data.get("result") or []
            put_oi = 0.0
            call_oi = 0.0
            for row in rows:
                name = str(row.get("instrument_name", ""))
                oi = float(row.get("open_interest") or 0)
                if name.endswith("-P"):
                    put_oi += oi
                elif name.endswith("-C"):
                    call_oi += oi

            dvol_history = await self._fetch_dvol_history(days=7)
            dvol = dvol_history[-1].value if dvol_history else None
            ratio = put_oi / call_oi if call_oi > 0 else 0.0

            return BtcOptionsSnapshot(
                put_open_interest=round(put_oi, 2),
                call_open_interest=round(call_oi, 2),
                put_call_ratio=round(ratio, 3),
                dvol_index=round(dvol, 2) if dvol is not None else None,
                dvol_history=dvol_history,
                instrument_count=len(rows),
                source="deribit",
                timestamp=datetime.now(timezone.utc),
            )
        except Exception as exc:
            logger.warning("deribit_options_failed", error=str(exc))
            return None

    async def _fetch_dvol_history(self, days: int = 7) -> list[MacroSeriesPoint]:
        try:
            now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
            start_ms = now_ms - days * 24 * 3600 * 1000
            data = await self.http.get_json(
                f"{BASE}/get_volatility_index_data",
                params={
                    "currency": "BTC",
                    "resolution": "3600",
                    "start_timestamp": start_ms,
                    "end_timestamp": now_ms,
                },
                rate_limit_key="deribit",
            )
            points = data.get("result")
            if isinstance(points, dict):
                points = points.get("data") or []
            if not points:
                return []

            # Sample one point per UTC day (last hourly close of each day)
            by_day: dict[str, MacroSeriesPoint] = {}
            for row in points:
                ts_ms = int(row[0])
                close = float(row[4])
                day_key = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
                by_day[day_key] = MacroSeriesPoint(
                    ts=datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc),
                    value=round(close, 2),
                )
            return sorted(by_day.values(), key=lambda p: p.ts)
        except Exception:
            return []
