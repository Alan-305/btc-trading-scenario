import pytest
import respx
import httpx
from datetime import datetime, timezone
from decimal import Decimal

from app.collectors.exchanges.binance import BinanceCollector, BASE as BN_BASE
from app.collectors.exchanges.bitbank import BitbankCollector, BASE as BB_BASE
from app.collectors.exchanges.coinbase import CoinbaseCollector, BASE as CB_BASE
from app.collectors.http_client import CollectorHttpClient
from app.schemas.market import NormalizedTicker
from app.services.divergence import DivergenceService
from app.services.market_aggregator import MarketAggregator
from app.schemas.market import MarketSnapshot


@pytest.mark.asyncio
@respx.mock
async def test_binance_fetch_ticker():
    respx.get(f"{BN_BASE}/ticker/24hr").mock(
        return_value=httpx.Response(
            200,
            json={
                "symbol": "BTCUSDT",
                "lastPrice": "97600.00",
                "bidPrice": "97590.00",
                "askPrice": "97610.00",
                "volume": "1000.5",
                "quoteVolume": "97600000",
            },
        )
    )
    http = CollectorHttpClient()
    ticker = await BinanceCollector(http).fetch_ticker("BTCUSDT")
    await http.aclose()
    assert ticker.exchange == "binance"
    assert float(ticker.last_price) == 97600.0


@pytest.mark.asyncio
@respx.mock
async def test_bitbank_fetch_ticker():
    respx.get(f"{BB_BASE}/btc_jpy/ticker").mock(
        return_value=httpx.Response(
            200,
            json={"success": 1, "data": {"last": "15000000", "buy": "14990000", "sell": "15010000", "vol": "100"}},
        )
    )
    http = CollectorHttpClient()
    ticker = await BitbankCollector(http).fetch_ticker("btc_jpy")
    await http.aclose()
    assert ticker.exchange == "bitbank"


@pytest.mark.asyncio
@respx.mock
async def test_coinbase_fetch_ticker():
    respx.get(f"{CB_BASE}/products/BTC-USD/ticker").mock(
        return_value=httpx.Response(
            200,
            json={"price": "97550.00", "bid": "97540", "ask": "97560", "volume": "500"},
        )
    )
    http = CollectorHttpClient()
    ticker = await CoinbaseCollector(http).fetch_ticker("BTC-USD")
    await http.aclose()
    assert ticker.exchange == "coinbase"


def test_divergence_service():
    now = datetime.now(timezone.utc)
    snapshot = MarketSnapshot(
        tickers=[
            NormalizedTicker(
                exchange="whitebit",
                symbol="BTC_USDT",
                last_price=Decimal("100000"),
                timestamp=now,
            ),
            NormalizedTicker(
                exchange="binance",
                symbol="BTCUSDT",
                last_price=Decimal("100200"),
                timestamp=now,
            ),
        ],
        orderbooks=[],
        collected_at=now,
    )
    result = DivergenceService("whitebit").apply(snapshot)
    assert result.divergence_pct["binance"] == pytest.approx(0.2, abs=0.01)


@pytest.mark.asyncio
async def test_market_aggregator_partial_failure():
    class OkCollector:
        exchange = "whitebit"

        async def fetch_ticker(self, symbol=None):
            return NormalizedTicker(
                exchange="whitebit",
                symbol="BTC_USDT",
                last_price=Decimal("100"),
                timestamp=datetime.now(timezone.utc),
            )

        async def fetch_orderbook(self, symbol=None, limit=50):
            raise RuntimeError("fail")

    class FailCollector:
        exchange = "binance"

        async def fetch_ticker(self, symbol=None):
            raise RuntimeError("fail")

        async def fetch_orderbook(self, symbol=None, limit=50):
            raise RuntimeError("fail")

    agg = MarketAggregator([OkCollector(), FailCollector()])
    snap = await agg.collect_all(include_orderbooks=False)
    assert len(snap.tickers) == 1
