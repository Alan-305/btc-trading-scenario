from datetime import datetime, timezone

import httpx
import pytest

from app.integrations.coingecko_usdt_dominance import (
    CoingeckoUsdtDominanceClient,
    _build_dominance_history,
    _build_dominance_history_estimated,
    _dominance_change_pct,
    _dominance_trend,
)
from app.schemas.extended_market import MacroSeriesPoint


class FakeHttp:
    async def get_json(self, url, params=None, rate_limit_key=None):
        if url.endswith("/global"):
            return {"data": {"market_cap_percentage": {"usdt": 5.42}}}
        if "tether/market_chart" in url:
            return {
                "market_caps": [
                    [1700000000000, 120_000_000_000],
                    [1700086400000, 121_000_000_000],
                ]
            }
        if "market_cap_chart" in url:
            return {
                "market_cap_chart": {
                    "market_cap": [
                        [1700000000000, 2_200_000_000_000],
                        [1700086400000, 2_250_000_000_000],
                    ]
                }
            }
        raise AssertionError(f"unexpected url {url}")


class FakeHttpProChartUnavailable:
    async def get_json(self, url, params=None, rate_limit_key=None):
        if url.endswith("/global"):
            return {"data": {"market_cap_percentage": {"usdt": 5.42}}}
        if "tether/market_chart" in url:
            return {
                "market_caps": [
                    [1700000000000, 120_000_000_000],
                    [1700086400000, 121_000_000_000],
                ]
            }
        if "market_cap_chart" in url:
            raise httpx.HTTPStatusError(
                "PRO only",
                request=httpx.Request("GET", url),
                response=httpx.Response(401),
            )
        raise AssertionError(f"unexpected url {url}")


@pytest.mark.asyncio
async def test_coingecko_usdt_dominance_snapshot():
    client = CoingeckoUsdtDominanceClient(FakeHttp())  # type: ignore[arg-type]
    snap = await client.fetch_snapshot()
    assert snap is not None
    assert snap.dominance_pct == 5.42
    assert snap.trend in ("rising", "falling", "stable")


@pytest.mark.asyncio
async def test_coingecko_usdt_dominance_snapshot_when_pro_chart_unavailable():
    client = CoingeckoUsdtDominanceClient(FakeHttpProChartUnavailable())  # type: ignore[arg-type]
    snap = await client.fetch_snapshot()
    assert snap is not None
    assert snap.dominance_pct == 5.42
    assert len(snap.history) >= 1
    assert snap.trend in ("rising", "falling", "stable")


@pytest.mark.asyncio
async def test_coingecko_usdt_dominance_global_only():
    class GlobalOnlyHttp:
        async def get_json(self, url, params=None, rate_limit_key=None):
            if url.endswith("/global"):
                return {"data": {"market_cap_percentage": {"usdt": 6.1}}}
            raise httpx.HTTPStatusError(
                "rate limited",
                request=httpx.Request("GET", url),
                response=httpx.Response(429),
            )

    client = CoingeckoUsdtDominanceClient(GlobalOnlyHttp())  # type: ignore[arg-type]
    snap = await client.fetch_snapshot()
    assert snap is not None
    assert snap.dominance_pct == 6.1
    assert snap.history == []
    assert snap.trend == "stable"


def test_dominance_history_and_trend_helpers():
    tether = {
        "market_caps": [
            [1700000000000, 100_000_000_000],
            [1700086400000, 110_000_000_000],
        ]
    }
    total = {
        "market_cap_chart": {
            "market_cap": [
                [1700000000000, 2_000_000_000_000],
                [1700086400000, 2_000_000_000_000],
            ]
        }
    }
    history = _build_dominance_history(tether, total)
    assert len(history) >= 1
    change = _dominance_change_pct(history, 5.5)
    assert change is not None
    assert _dominance_trend(0.3) == "rising"
    assert _dominance_trend(-0.3) == "falling"
    assert _dominance_trend(0.1) == "stable"


def test_dominance_history_estimated_helper():
    tether = {
        "market_caps": [
            [1700000000000, 100_000_000_000],
            [1700086400000, 110_000_000_000],
        ]
    }
    history = _build_dominance_history_estimated(tether, 5.0)
    assert len(history) >= 1
    assert history[-1].value == pytest.approx(5.0, rel=1e-3)
