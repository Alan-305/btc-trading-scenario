import type { NormalizedTicker } from "../../types/scenario";
import type { DataRefreshProps } from "../../types/data-refresh";
import { EXCHANGE_URLS, EXTERNAL_LINKS } from "../../lib/external-links";
import { DataPanelMeta } from "../ui/DataPanelMeta";
import { ExternalLink } from "../ui/ExternalLink";

interface ExchangeDivergenceProps extends DataRefreshProps {
  tickers: NormalizedTicker[];
  divergence: Record<string, number>;
  collectedAt?: string | null;
}

const EXCHANGE_LABEL: Record<string, string> = {
  whitebit: "WhiteBIT",
  binance: "Binance",
  bybit: "Bybit",
  bitget: "Bitget",
  coinbase: "Coinbase",
};

export function ExchangeDivergence({
  tickers,
  divergence,
  collectedAt,
  onRefresh,
  refreshing,
}: ExchangeDivergenceProps) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <DataPanelMeta
        title="取引所価格・乖離"
        subtitle="基準は WhiteBIT（シナリオの参照価格）"
        sourceHref={EXTERNAL_LINKS.whitebit}
        sourceLabel="WhiteBIT"
        updatedAt={collectedAt}
        onRefresh={onRefresh}
        refreshing={refreshing}
        refreshLabel="取引所価格を更新"
      />
      <ul className="space-y-2">
        {tickers.map((t) => {
          const div = divergence[t.exchange] ?? 0;
          const divColor =
            div > 0.1 ? "text-accent-green" : div < -0.1 ? "text-accent-red" : "text-content-secondary";
          const url = EXCHANGE_URLS[t.exchange];
          return (
            <li key={t.exchange} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-english text-slate-300">
                {EXCHANGE_LABEL[t.exchange] ?? t.exchange}
                {url && (
                  <ExternalLink href={url} className="ml-2 min-h-0 py-0">
                    開く
                  </ExternalLink>
                )}
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
