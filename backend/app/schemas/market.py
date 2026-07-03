from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


ExchangeId = Literal["whitebit", "binance", "coinbase", "bybit", "bitget"]


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


class FearGreedHistoryPoint(BaseModel):
    period: Literal["now", "yesterday", "last_week", "last_month"]
    label_ja: str
    value: int
    classification: str


class FearGreedIndicators(BaseModel):
    current: FearGreedIndex
    history: list[FearGreedHistoryPoint] = Field(default_factory=list)


class ExchangeDerivatives(BaseModel):
    exchange: str
    symbol: str
    funding_rate: float | None = None
    open_interest_usd: float | None = None
    long_short_ratio: float | None = None
    long_short_position_ratio: float | None = None
    top_trader_long_short_ratio: float | None = None
    long_short_ratio_prev_24h: float | None = None
    long_short_ratio_change_24h: float | None = None
    mark_price: float | None = None
    quote_currency: str | None = None  # USD, JPY, etc.


class CoinglassSnapshot(BaseModel):
    open_interest_usd: float | None = None
    funding_rate: float | None = None
    liquidation_24h_usd: float | None = None
    long_short_ratio: float | None = None
    long_short_position_ratio: float | None = None
    top_trader_long_short_ratio: float | None = None
    long_short_ratio_prev_24h: float | None = None
    long_short_ratio_change_24h: float | None = None
    long_short_signal: (
        Literal[
            "overheated_long",
            "overheated_short",
            "divergence",
            "rapid_change",
            "neutral",
        ]
        | None
    ) = None
    long_short_signal_ja: str = ""
    long_short_summary_ja: str = ""
    long_short_stance: Literal["bullish", "bearish", "neutral", "caution"] = "neutral"
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
    fear_greed_history: list[FearGreedHistoryPoint] = Field(default_factory=list)
    coinglass: CoinglassSnapshot | None = None
    x_sentiment_score: float | None = None
    fetched_at: datetime | None = None
