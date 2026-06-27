from app.collectors.base import BaseCollector
from app.collectors.exchanges.binance import BinanceCollector
from app.collectors.exchanges.bitbank import BitbankCollector
from app.collectors.exchanges.coinbase import CoinbaseCollector
from app.collectors.exchanges.whitebit import WhitebitCollector
from app.collectors.http_client import CollectorHttpClient


def build_collectors(http: CollectorHttpClient) -> list[BaseCollector]:
    return [
        WhitebitCollector(http),
        BinanceCollector(http),
        BitbankCollector(http),
        CoinbaseCollector(http),
    ]
