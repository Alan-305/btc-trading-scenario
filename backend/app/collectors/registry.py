from app.collectors.base import BaseCollector
from app.collectors.exchanges.binance import BinanceCollector
from app.collectors.exchanges.bitget import BitgetCollector
from app.collectors.exchanges.bybit import BybitCollector
from app.collectors.exchanges.coinbase import CoinbaseCollector
from app.collectors.exchanges.whitebit import WhitebitCollector
from app.collectors.http_client import CollectorHttpClient


def build_collectors(http: CollectorHttpClient) -> list[BaseCollector]:
    return [
        WhitebitCollector(http),
        BinanceCollector(http),
        BybitCollector(http),
        BitgetCollector(http),
        CoinbaseCollector(http),
    ]
