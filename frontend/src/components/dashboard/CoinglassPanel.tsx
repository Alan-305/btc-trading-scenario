import type { CoinglassSnapshot, ExchangeDerivatives } from "../../types/scenario";
import { EXTERNAL_LINKS } from "../../lib/external-links";
import { ExternalLink } from "../ui/ExternalLink";

interface CoinglassPanelProps {
  data: CoinglassSnapshot | null;
}

const EXCHANGE_LABEL: Record<string, string> = {
  binance: "Binance",
  bybit: "Bybit",
  okx: "OKX",
  whitebit: "WhiteBIT",
  bitget: "Bitget",
};

const EXCHANGE_LINKS: Record<string, string> = {
  binance: EXTERNAL_LINKS.binanceFutures,
  bybit: EXTERNAL_LINKS.bybitFutures,
  okx: EXTERNAL_LINKS.okxFutures,
  whitebit: EXTERNAL_LINKS.whitebit,
  bitget: EXTERNAL_LINKS.bitget,
};

function formatOi(ex: ExchangeDerivatives): string {
  if (ex.open_interest_usd == null) return "—";
  return `$${(ex.open_interest_usd / 1e9).toFixed(2)}B`;
}

function formatPrice(ex: ExchangeDerivatives): string | null {
  if (ex.mark_price == null) return null;
  return `$${ex.mark_price.toLocaleString()}`;
}

export function CoinglassPanel({ data }: CoinglassPanelProps) {
  const exchanges = data?.exchanges ?? [];

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-content-secondary">
          先物指標
          {data?.source && (
            <span className="ml-2 text-xs font-normal text-content-muted">
              ({data.source === "free_aggregate" ? "無料・複数取引所" : data.source})
            </span>
          )}
        </h3>
        <ExternalLink href={EXTERNAL_LINKS.binanceFutures}>Binance</ExternalLink>
      </div>

      {data && (data.open_interest_usd != null || data.funding_rate != null) && (
        <dl className="mb-4 space-y-1 border-b border-surface-border pb-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-content-muted">合計 OI (USD)</dt>
            <dd className="font-english text-slate-200">
              {data.open_interest_usd
                ? `$${(data.open_interest_usd / 1e9).toFixed(2)}B`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-content-muted">平均 Funding</dt>
            <dd className="font-english text-slate-200">
              {data.funding_rate != null ? `${(data.funding_rate * 100).toFixed(4)}%` : "—"}
            </dd>
          </div>
        </dl>
      )}

      {exchanges.length > 0 ? (
        <ul className="space-y-2 text-xs">
          {exchanges.map((ex) => (
            <li
              key={ex.exchange}
              className="flex flex-wrap items-center justify-between gap-1 rounded-md bg-surface-hover/50 px-2 py-1.5"
            >
              <span className="font-english text-slate-300">
                {EXCHANGE_LABEL[ex.exchange] ?? ex.exchange}
                {EXCHANGE_LINKS[ex.exchange] && (
                  <ExternalLink href={EXCHANGE_LINKS[ex.exchange]} className="ml-1 min-h-0 py-0">
                    ↗
                  </ExternalLink>
                )}
              </span>
              {formatPrice(ex) && (
                <span className="font-english text-content-secondary">{formatPrice(ex)}</span>
              )}
              <span className="font-english text-content-secondary">
                {ex.funding_rate != null
                  ? `FR ${(ex.funding_rate * 100).toFixed(4)}%`
                  : "FR —"}
              </span>
              <span className="font-english text-content-muted">
                OI {formatOi(ex)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-content-muted">データなし</p>
      )}
    </div>
  );
}
