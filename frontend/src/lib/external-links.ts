export const EXTERNAL_LINKS = {
  fearGreed: "https://alternative.me/crypto/fear-and-greed-index/",
  binanceFutures: "https://www.binance.com/en/futures/BTCUSDT",
  bybitFutures: "https://www.bybit.com/trade/usdt/BTCUSDT",
  okxFutures: "https://www.okx.com/trade-swap/btc-usdt-swap",
  whitebit: "https://whitebit.com/trade/BTC_USDT",
  bybit: "https://www.bybit.com/trade/spot/BTC/USDT",
  bitget: "https://www.bitget.com/spot/BTCUSDT",
  coinbase: "https://www.coinbase.com/advanced-trade/BTC-USD",
  tradingView: "https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT",
} as const;

export const EXCHANGE_URLS: Record<string, string> = {
  whitebit: EXTERNAL_LINKS.whitebit,
  binance: EXTERNAL_LINKS.binanceFutures,
  bybit: EXTERNAL_LINKS.bybit,
  bitget: EXTERNAL_LINKS.bitget,
  coinbase: EXTERNAL_LINKS.coinbase,
};
