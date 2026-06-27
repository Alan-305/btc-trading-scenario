import pytest
import respx
import httpx

from app.integrations.binance_futures import BinanceFuturesClient, BASE as BN_BASE
from app.integrations.bybit_futures import BybitFuturesClient, BASE as BYBIT_BASE
from app.integrations.okx_futures import OkxFuturesClient
from app.integrations.whitebit_futures import WhitebitFuturesClient, BASE as WB_BASE


@pytest.mark.asyncio
@respx.mock
async def test_binance_futures_fetch():
    respx.get(f"{BN_BASE}/fapi/v1/premiumIndex").mock(
        return_value=httpx.Response(
            200,
            json={"symbol": "BTCUSDT", "markPrice": "100000", "lastFundingRate": "0.0001"},
        )
    )
    respx.get(f"{BN_BASE}/fapi/v1/openInterest").mock(
        return_value=httpx.Response(200, json={"symbol": "BTCUSDT", "openInterest": "50000"})
    )
    respx.get(f"{BN_BASE}/futures/data/globalLongShortAccountRatio").mock(
        return_value=httpx.Response(200, json=[{"longShortRatio": "1.25"}])
    )

    from app.collectors.http_client import CollectorHttpClient

    http = CollectorHttpClient()
    row = await BinanceFuturesClient(http).fetch()
    await http.aclose()

    assert row is not None
    assert row.exchange == "binance"
    assert row.funding_rate == pytest.approx(0.0001)
    assert row.open_interest_usd == pytest.approx(5_000_000_000)


@pytest.mark.asyncio
@respx.mock
async def test_bybit_futures_fetch():
    respx.get(f"{BYBIT_BASE}/tickers").mock(
        return_value=httpx.Response(
            200,
            json={
                "result": {
                    "list": [
                        {
                            "symbol": "BTCUSDT",
                            "markPrice": "100000",
                            "openInterest": "1000",
                            "fundingRate": "0.00015",
                        }
                    ]
                }
            },
        )
    )
    from app.collectors.http_client import CollectorHttpClient

    http = CollectorHttpClient()
    row = await BybitFuturesClient(http).fetch()
    await http.aclose()

    assert row is not None
    assert row.exchange == "bybit"
    assert row.funding_rate == pytest.approx(0.00015)


@pytest.mark.asyncio
@respx.mock
async def test_okx_futures_fetch():
    respx.get("https://www.okx.com/api/v5/public/funding-rate").mock(
        return_value=httpx.Response(200, json={"data": [{"fundingRate": "0.0002"}]})
    )
    respx.get("https://www.okx.com/api/v5/public/open-interest").mock(
        return_value=httpx.Response(200, json={"data": [{"oiCcy": "9000000000"}]})
    )
    respx.get("https://www.okx.com/api/v5/market/ticker").mock(
        return_value=httpx.Response(200, json={"data": [{"last": "100000"}]})
    )
    from app.collectors.http_client import CollectorHttpClient

    http = CollectorHttpClient()
    row = await OkxFuturesClient(http).fetch()
    await http.aclose()

    assert row is not None
    assert row.exchange == "okx"
    assert row.open_interest_usd == pytest.approx(9_000_000_000)


@pytest.mark.asyncio
@respx.mock
async def test_whitebit_futures_fetch():
    respx.get(f"{WB_BASE}/futures").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "ticker_id": "BTC_PERP",
                    "funding_rate": "0.00005",
                    "open_interest": "500",
                    "index_price": "100000",
                }
            ],
        )
    )
    from app.collectors.http_client import CollectorHttpClient

    http = CollectorHttpClient()
    row = await WhitebitFuturesClient(http).fetch()
    await http.aclose()

    assert row is not None
    assert row.exchange == "whitebit"
    assert row.symbol == "BTC_PERP"


@pytest.mark.asyncio
@respx.mock
async def test_bitbank_market_fetch():
    respx.get("https://public.bitbank.cc/btc_jpy/ticker").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": 1,
                "data": {"last": "15000000", "vol": "100", "buy": "14990000", "sell": "15010000"},
            },
        )
    )
    from app.collectors.http_client import CollectorHttpClient
    from app.integrations.bitbank_market import BitbankMarketClient

    http = CollectorHttpClient()
    row = await BitbankMarketClient(http).fetch()
    await http.aclose()

    assert row is not None
    assert row.exchange == "bitbank"
    assert row.quote_currency == "JPY"
    assert row.mark_price == pytest.approx(15_000_000)
    assert row.funding_rate is None


@pytest.mark.asyncio
@respx.mock
async def test_free_derivatives_aggregator(monkeypatch):
    monkeypatch.setenv("DERIVATIVES_EXCHANGES", "binance,bybit")
    from app.config import get_settings

    get_settings.cache_clear()

    respx.get(f"{BN_BASE}/fapi/v1/premiumIndex").mock(
        return_value=httpx.Response(200, json={"markPrice": "100000", "lastFundingRate": "0.0001"})
    )
    respx.get(f"{BN_BASE}/fapi/v1/openInterest").mock(
        return_value=httpx.Response(200, json={"openInterest": "100"})
    )
    respx.get(f"{BN_BASE}/futures/data/globalLongShortAccountRatio").mock(
        return_value=httpx.Response(200, json=[])
    )
    respx.get(f"{BYBIT_BASE}/tickers").mock(
        return_value=httpx.Response(
            200,
            json={"result": {"list": [{"markPrice": "100000", "openInterest": "100", "fundingRate": "0.0003"}]}},
        )
    )

    from app.collectors.http_client import CollectorHttpClient
    from app.integrations.free_derivatives_aggregator import FreeDerivativesAggregator

    http = CollectorHttpClient()
    snap = await FreeDerivativesAggregator(http).fetch_snapshot()
    await http.aclose()

    assert snap.source == "free_aggregate"
    assert len(snap.exchanges) == 2
    assert snap.open_interest_usd == pytest.approx(20_000_000)
    assert snap.funding_rate == pytest.approx(0.0002)
    get_settings.cache_clear()
