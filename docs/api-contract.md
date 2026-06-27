# API Contract

Frontend ↔ Backend JSON specifications.

## GET /api/v1/market/snapshot

```json
{
  "tickers": [
    {
      "exchange": "whitebit",
      "symbol": "BTC_USDT",
      "last_price": "97500.50",
      "bid": "97490.00",
      "ask": "97510.00",
      "volume_24h": "1265.43",
      "quote_volume_24h": "123456789.12",
      "timestamp": "2026-06-27T06:00:00Z"
    }
  ],
  "orderbooks": [],
  "divergence_pct": {
    "whitebit": 0.0,
    "binance": 0.15,
    "coinbase": -0.05
  },
  "collected_at": "2026-06-27T06:00:00Z"
}
```

Query: `?refresh=true` bypasses Redis cache.

## GET /api/v1/indicators/sentiment

```json
{
  "fear_greed": {
    "value": 68,
    "classification": "Greed",
    "timestamp": "2026-06-27T00:00:00Z"
  },
  "coinglass": {
    "open_interest_usd": 25000000000,
    "funding_rate": 0.012,
    "liquidation_24h_usd": null,
    "long_short_ratio": null,
    "timestamp": "2026-06-27T06:00:00Z"
  },
  "x_sentiment_score": null
}
```

## GET /api/v1/scenario

```json
{
  "macro_trend": "bullish",
  "confidence": 0.72,
  "entry": {
    "side": "long",
    "zone_low": 95000,
    "zone_high": 96200,
    "rationale": "基準価格付近のエントリー帯"
  },
  "exit": {
    "take_profit": [98500, 101200],
    "stop_loss": 93800,
    "rationale": "抵抗帯とリスク許容幅に基づく"
  },
  "forecast": [
    { "ts": "2026-06-27T07:00:00Z", "price": 97800 }
  ],
  "scenario_text_ja": "本日のBTCは...",
  "indicators": {
    "fear_greed": 68,
    "funding_rate": 0.012,
    "oi_change_24h_pct": null,
    "divergence_max_pct": 0.2
  },
  "generated_at": "2026-06-27T06:00:00Z",
  "disclaimer": "本情報は参考情報であり、投資助言ではありません。"
}
```

Query: `?refresh=true` regenerates scenario.

## GET /api/v1/market/volume-profile

```json
{
  "bins": [
    { "price_low": 97000, "price_high": 97200, "volume": 12.5 }
  ]
}
```

## GET /api/v1/market/orderbook-heatmap

```json
{
  "cells": [
    { "price_bin": 97500, "bid_depth": 2.5, "ask_depth": 1.8 }
  ]
}
```

## POST /api/v1/internal/collect

Header: `X-Internal-Token: <INTERNAL_COLLECT_TOKEN>` (when configured)

Response:

```json
{
  "status": "collected",
  "tickers": 4,
  "orderbooks": 4
}
```

## macro_trend values

- `bullish` — 上昇トレンド寄り
- `bearish` — 下降トレンド寄り
- `range` — レンジ（横ばい）

## entry.side values

- `long` / `short` / `neutral`
