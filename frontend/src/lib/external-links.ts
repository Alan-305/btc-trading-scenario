export const EXTERNAL_LINKS = {
  fearGreed: "https://alternative.me/crypto/fear-and-greed-index/",
  binanceFutures: "https://www.binance.com/en/futures/BTCUSDT",
  binanceSpot: "https://www.binance.com/en/trade/BTC_USDT",
  bybitFutures: "https://www.bybit.com/trade/usdt/BTCUSDT",
  okxFutures: "https://www.okx.com/trade-swap/btc-usdt-swap",
  whitebit: "https://whitebit.com/trade/BTC_USDT",
  bybit: "https://www.bybit.com/trade/spot/BTC/USDT",
  bitget: "https://www.bitget.com/spot/BTCUSDT",
  coinbase: "https://www.coinbase.com/advanced-trade/BTC-USD",
  tradingView: "https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT",
  usdtDominance: "https://www.tradingview.com/chart/?symbol=CRYPTOCAP:USDT.D",
  coingecko: "https://www.coingecko.com/",
  coinglass: "https://www.coinglass.com/",
  deribit: "https://www.deribit.com/statistics/BTC/options-data",
  blockchainCharts: "https://www.blockchain.com/charts",
  mempool: "https://mempool.space/",
  yahooFinance: "https://finance.yahoo.com/",
  finnhub: "https://finnhub.io/economic-calendar",
  forexFactory: "https://www.forexfactory.com/calendar",
} as const;

export const EXCHANGE_URLS: Record<string, string> = {
  whitebit: EXTERNAL_LINKS.whitebit,
  binance: EXTERNAL_LINKS.binanceFutures,
  bybit: EXTERNAL_LINKS.bybit,
  bitget: EXTERNAL_LINKS.bitget,
  coinbase: EXTERNAL_LINKS.coinbase,
};
