# Data Model

## NormalizedTicker

| Field | Type | Description |
|-------|------|-------------|
| exchange | string | whitebit, binance, bitbank, coinbase |
| symbol | string | Exchange-native symbol |
| last_price | decimal | Last traded price |
| bid | decimal? | Best bid |
| ask | decimal? | Best ask |
| volume_24h | decimal? | Base volume 24h |
| quote_volume_24h | decimal? | Quote volume 24h |
| timestamp | datetime | UTC collection time |

## MarketSnapshot

Aggregated multi-exchange state. Cached in Redis under `market:snapshot`.

## ScenarioResponse

Trading scenario output combining ML signal + LLM/template narrative.

## Redis Keys

| Key | TTL | Content |
|-----|-----|---------|
| market:snapshot | 60s | MarketSnapshot JSON |
| indicators:fear_greed | 60s | FearGreedIndex JSON |
| indicators:coinglass | 60s | CoinglassSnapshot JSON |
| scenario:latest | 120s | ScenarioResponse JSON |
