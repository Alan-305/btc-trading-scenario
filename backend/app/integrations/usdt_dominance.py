from __future__ import annotations

from datetime import datetime, timezone

from app.collectors.http_client import CollectorHttpClient
from app.integrations.coingecko_usdt_dominance import (
    CoingeckoUsdtDominanceClient,
    _dominance_change_pct,
    _dominance_trend,
)
from app.schemas.extended_market import MacroSeriesPoint, UsdtDominanceSnapshot

COINGECKO_BASE = "https://api.coingecko.com/api/v3"
TV_SCAN_URL = "https://scanner.tradingview.com/global/scan"
TV_TICKER = "CRYPTOCAP:USDT.D"


class UsdtDominanceClient:
    """USDT.D aligned with TradingView CRYPTOCAP:USDT.D (7d shape via CoinGecko tether mcap)."""

    def __init__(self, http: CollectorHttpClient):
        self.http = http
        self._coingecko = CoingeckoUsdtDominanceClient(http)

    async def fetch_snapshot(self) -> UsdtDominanceSnapshot | None:
        current_dom = await self._fetch_tradingview_current()
        source = "tradingview"

        if current_dom is None:
            return await self._coingecko.fetch_snapshot()

        tether_chart: dict | None = None
        try:
            tether_chart = await self.http.get_json(
                f"{COINGECKO_BASE}/coins/tether/market_chart",
                params={"vs_currency": "usd", "days": 7},
                rate_limit_key="coingecko",
            )
        except Exception:
            tether_chart = None

        history = (
            _build_history_from_tether_mcap(tether_chart, current_dom)
            if tether_chart
            else []
        )
        change_7d = _dominance_change_pct(history, current_dom)
        trend = _dominance_trend(change_7d)

        return UsdtDominanceSnapshot(
            dominance_pct=round(current_dom, 3),
            change_7d_pct=round(change_7d, 3) if change_7d is not None else None,
            trend=trend,
            history=history,
            source=source,
            timestamp=datetime.now(timezone.utc),
        )

    async def _fetch_tradingview_current(self) -> float | None:
        try:
            payload = {
                "symbols": {"tickers": [TV_TICKER], "query": {"types": []}},
                "columns": ["close"],
                "range": [0, 1],
            }
            result = await self.http.post_json(
                TV_SCAN_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
                rate_limit_key="tradingview",
            )
        except Exception:
            return None

        rows = result.get("data") or []
        if not rows:
            return None
        values = rows[0].get("d") or []
        if not values or values[0] is None:
            return None
        dom = float(values[0])
        if dom <= 0:
            return None
        return dom


def _build_history_from_tether_mcap(
    tether_chart: dict,
    current_dom: float,
) -> list[MacroSeriesPoint]:
    """Scale 7d dominance from USDT market-cap moves, anchored to TradingView current."""
    tether_caps = tether_chart.get("market_caps") or []
    if not tether_caps or current_dom <= 0:
        return []

    by_day: dict[str, MacroSeriesPoint] = {}
    for ts_ms, usdt_cap in tether_caps:
        if not usdt_cap or usdt_cap <= 0:
            continue
        dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
        key = dt.strftime("%Y-%m-%d")
        by_day[key] = MacroSeriesPoint(ts=dt, value=float(usdt_cap))

    daily_caps = sorted(by_day.values(), key=lambda p: p.ts)
    if not daily_caps:
        return []

    anchor_cap = daily_caps[-1].value
    if anchor_cap <= 0:
        return []

    history = [
        MacroSeriesPoint(
            ts=point.ts,
            value=round(current_dom * (point.value / anchor_cap), 3),
        )
        for point in daily_caps
    ]
    if history:
        history[-1] = MacroSeriesPoint(ts=history[-1].ts, value=round(current_dom, 3))
    return history
