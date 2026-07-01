import httpx
import pytest

from app.integrations.usdt_dominance import UsdtDominanceClient, _build_history_from_tether_mcap


class FakeHttp:
    async def get_json(self, url, params=None, rate_limit_key=None):
        if "tether/market_chart" in url:
            return {
                "market_caps": [
                    [1700000000000, 120_000_000_000],
                    [1700086400000, 121_000_000_000],
                    [1700172800000, 122_000_000_000],
                ]
            }
        raise AssertionError(f"unexpected url {url}")

    async def post_json(self, url, json=None, headers=None, rate_limit_key=None):
        assert url.endswith("/global/scan")
        return {"data": [{"s": "CRYPTOCAP:USDT.D", "d": [8.977]}]}


class FakeHttpTvUnavailable(FakeHttp):
    async def post_json(self, url, json=None, headers=None, rate_limit_key=None):
        raise httpx.HTTPStatusError(
            "unavailable",
            request=httpx.Request("POST", url),
            response=httpx.Response(503),
        )

    async def get_json(self, url, params=None, rate_limit_key=None):
        if url.endswith("/global"):
            return {"data": {"market_cap_percentage": {"usdt": 8.54}}}
        if "tether/market_chart" in url:
            return {"market_caps": [[1700000000000, 120_000_000_000]]}
        raise AssertionError(f"unexpected url {url}")


@pytest.mark.asyncio
async def test_usdt_dominance_uses_tradingview_current():
    client = UsdtDominanceClient(FakeHttp())  # type: ignore[arg-type]
    snap = await client.fetch_snapshot()
    assert snap is not None
    assert snap.dominance_pct == 8.977
    assert snap.source == "tradingview"
    assert len(snap.history) >= 1
    assert snap.history[-1].value == 8.977


@pytest.mark.asyncio
async def test_usdt_dominance_falls_back_to_coingecko():
    client = UsdtDominanceClient(FakeHttpTvUnavailable())  # type: ignore[arg-type]
    snap = await client.fetch_snapshot()
    assert snap is not None
    assert snap.dominance_pct == 8.54
    assert snap.source == "coingecko"


def test_build_history_from_tether_mcap_anchors_to_current():
    tether = {
        "market_caps": [
            [1700000000000, 100_000_000_000],
            [1700086400000, 110_000_000_000],
        ]
    }
    history = _build_history_from_tether_mcap(tether, 8.977)
    assert len(history) >= 1
    assert history[-1].value == 8.977
    assert history[0].value < history[-1].value
