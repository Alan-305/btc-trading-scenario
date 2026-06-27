from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


ExchangeId = Literal["whitebit", "binance", "bitbank", "coinbase"]


class OrderBookLevel(BaseModel):
    price: Decimal
    size: Decimal


class NormalizedTicker(BaseModel):
    exchange: ExchangeId
    symbol: str
    last_price: Decimal
    bid: Decimal | None = None
    ask: Decimal | None = None
    volume_24h: Decimal | None = None
    quote_volume_24h: Decimal | None = None
    timestamp: datetime


class NormalizedOrderBook(BaseModel):
    exchange: ExchangeId
    symbol: str
    bids: list[OrderBookLevel]
    asks: list[OrderBookLevel]
    timestamp: datetime


class MarketSnapshot(BaseModel):
    tickers: list[NormalizedTicker]
    orderbooks: list[NormalizedOrderBook]
    divergence_pct: dict[str, float] = Field(default_factory=dict)
    collected_at: datetime


class FearGreedIndex(BaseModel):
    value: int
    classification: str
    timestamp: datetime


class ExchangeDerivatives(BaseModel):
    exchange: str
    symbol: str
    funding_rate: float | None = None
    open_interest_usd: float | None = None
    long_short_ratio: float | None = None
    mark_price: float | None = None
    quote_currency: str | None = None  # USD, JPY, etc.


class CoinglassSnapshot(BaseModel):
    open_interest_usd: float | None = None
    funding_rate: float | None = None
    liquidation_24h_usd: float | None = None
    long_short_ratio: float | None = None
    source: str | None = None  # free_aggregate | binance | coinglass | none
    exchanges: list[ExchangeDerivatives] = Field(default_factory=list)
    timestamp: datetime


class VolumeProfileBin(BaseModel):
    price_low: float
    price_high: float
    volume: float


class OrderbookHeatmapCell(BaseModel):
    price_bin: float
    bid_depth: float
    ask_depth: float


class SentimentIndicators(BaseModel):
    fear_greed: FearGreedIndex | None = None
    coinglass: CoinglassSnapshot | None = None
    x_sentiment_score: float | None = None
