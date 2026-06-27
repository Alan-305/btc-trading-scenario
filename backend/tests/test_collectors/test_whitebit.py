import pytest
import respx
import httpx

from app.collectors.exchanges.whitebit import WhitebitCollector, BASE
from app.collectors.http_client import CollectorHttpClient


@pytest.fixture
def whitebit_ticker_response():
    return {
        "BTC_USDT": {
            "base_id": 1,
            "quote_id": 826,
            "last_price": "97500.50",
            "quote_volume": "123456789.12",
            "base_volume": "1265.43",
            "bid": "97490.00",
            "ask": "97510.00",
            "high": "98000.00",
            "low": "96000.00",
            "change": "1.25",
        }
    }


@pytest.fixture
def whitebit_orderbook_response():
    return {
        "ticker_id": "BTC_USDT",
        "timestamp": 1719500000,
        "bids": [["97490.00", "0.5"], ["97480.00", "1.2"]],
        "asks": [["97510.00", "0.3"], ["97520.00", "0.8"]],
    }


@pytest.mark.asyncio
@respx.mock
async def test_whitebit_fetch_ticker(whitebit_ticker_response):
    respx.get(f"{BASE}/ticker").mock(return_value=httpx.Response(200, json=whitebit_ticker_response))
    http = CollectorHttpClient()
    collector = WhitebitCollector(http)
    ticker = await collector.fetch_ticker("BTC_USDT")
    await http.aclose()

    assert ticker.exchange == "whitebit"
    assert ticker.symbol == "BTC_USDT"
    assert float(ticker.last_price) == 97500.50
    assert float(ticker.bid) == 97490.00


@pytest.mark.asyncio
@respx.mock
async def test_whitebit_fetch_orderbook(whitebit_orderbook_response):
    respx.get(f"{BASE}/orderbook/BTC_USDT").mock(
        return_value=httpx.Response(200, json=whitebit_orderbook_response)
    )
    http = CollectorHttpClient()
    collector = WhitebitCollector(http)
    ob = await collector.fetch_orderbook("BTC_USDT", limit=50)
    await http.aclose()

    assert ob.exchange == "whitebit"
    assert len(ob.bids) == 2
    assert len(ob.asks) == 2
