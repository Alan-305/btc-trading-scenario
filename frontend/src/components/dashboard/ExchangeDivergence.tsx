import type { NormalizedTicker } from "../../types/scenario";

interface ExchangeDivergenceProps {
  tickers: NormalizedTicker[];
  divergence: Record<string, number>;
}

const EXCHANGE_LABEL: Record<string, string> = {
  whitebit: "WhiteBIT",
  binance: "Binance",
  bitbank: "bitbank",
  coinbase: "Coinbase",
};

export function ExchangeDivergence({ tickers, divergence }: ExchangeDivergenceProps) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h3 className="mb-3 text-sm font-medium text-slate-400">取引所価格・乖離</h3>
      <ul className="space-y-2">
        {tickers.map((t) => {
          const div = divergence[t.exchange] ?? 0;
          const divColor =
            div > 0.1 ? "text-accent-green" : div < -0.1 ? "text-accent-red" : "text-slate-400";
          return (
            <li key={t.exchange} className="flex items-center justify-between text-sm">
              <span className="font-english text-slate-300">
                {EXCHANGE_LABEL[t.exchange] ?? t.exchange}
              </span>
              <span className="font-english text-slate-100">
                ${parseFloat(t.last_price).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className={`font-english text-xs ${divColor}`}>
                {div >= 0 ? "+" : ""}
                {div.toFixed(2)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
