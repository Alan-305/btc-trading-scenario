from __future__ import annotations

from datetime import datetime, timezone

from app.collectors.http_client import CollectorHttpClient
from app.schemas.extended_market import MacroSeriesPoint, UsdtDominanceSnapshot

BASE = "https://api.coingecko.com/api/v3"


class CoingeckoUsdtDominanceClient:
    def __init__(self, http: CollectorHttpClient):
        self.http = http

    async def fetch_snapshot(self) -> UsdtDominanceSnapshot | None:
        try:
            global_data = await self.http.get_json(
                f"{BASE}/global",
                rate_limit_key="coingecko_global",
            )
            tether_chart = await self.http.get_json(
                f"{BASE}/coins/tether/market_chart",
                params={"vs_currency": "usd", "days": 7},
                rate_limit_key="coingecko_tether",
            )
            total_chart = await self.http.get_json(
                f"{BASE}/global/market_cap_chart",
                params={"days": 7},
                rate_limit_key="coingecko_global_chart",
            )
        except Exception:
            return None

        pct_map = (global_data.get("data") or {}).get("market_cap_percentage") or {}
        current_dom = pct_map.get("usdt")
        if current_dom is None:
            return None

        history = _build_dominance_history(tether_chart, total_chart)
        change_7d = _dominance_change_pct(history, float(current_dom))
        trend = _dominance_trend(change_7d)

        return UsdtDominanceSnapshot(
            dominance_pct=round(float(current_dom), 3),
            change_7d_pct=round(change_7d, 3) if change_7d is not None else None,
            trend=trend,
            history=history,
            source="coingecko",
            timestamp=datetime.now(timezone.utc),
        )


def _build_dominance_history(
    tether_chart: dict,
    total_chart: dict,
) -> list[MacroSeriesPoint]:
    tether_caps = tether_chart.get("market_caps") or []
    total_caps = (total_chart.get("market_cap_chart") or {}).get("market_cap") or []

    if not tether_caps or not total_caps:
        return []

    total_by_day: dict[str, float] = {}
    for ts_ms, cap in total_caps:
        if cap and cap > 0:
            day = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            total_by_day[day] = float(cap)

    points: list[MacroSeriesPoint] = []
    for ts_ms, usdt_cap in tether_caps:
        if not usdt_cap or usdt_cap <= 0:
            continue
        dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
        day = dt.strftime("%Y-%m-%d")
        total = total_by_day.get(day)
        if not total or total <= 0:
            continue
        dom = float(usdt_cap) / total * 100
        points.append(MacroSeriesPoint(ts=dt, value=round(dom, 3)))

    # One point per day (last sample of the day)
    by_day: dict[str, MacroSeriesPoint] = {}
    for p in points:
        key = p.ts.strftime("%Y-%m-%d")
        by_day[key] = p
    return sorted(by_day.values(), key=lambda p: p.ts)


def _dominance_change_pct(history: list[MacroSeriesPoint], current: float) -> float | None:
    if len(history) >= 2:
        first = history[0].value
        last = history[-1].value
        if first > 0:
            return last - first
    if len(history) == 1 and history[0].value > 0:
        return current - history[0].value
    return None


def _dominance_trend(change_7d: float | None) -> str:
    if change_7d is None:
        return "stable"
    if change_7d >= 0.25:
        return "rising"
    if change_7d <= -0.25:
        return "falling"
    return "stable"
