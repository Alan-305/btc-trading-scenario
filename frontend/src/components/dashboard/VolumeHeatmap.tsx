import { useMemo } from "react";
import type { HeatmapCell, HeatmapExchange } from "../../types/scenario";
import type { DataRefreshProps } from "../../types/data-refresh";
import { EXCHANGE_URLS, EXTERNAL_LINKS } from "../../lib/external-links";
import { DataPanelMeta } from "../ui/DataPanelMeta";

const HEATMAP_EXCHANGES: { value: HeatmapExchange; label: string }[] = [
  { value: "all", label: "全取引所" },
  { value: "whitebit", label: "WhiteBIT" },
  { value: "binance", label: "Binance" },
  { value: "bybit", label: "Bybit" },
  { value: "bitget", label: "Bitget" },
  { value: "coinbase", label: "Coinbase" },
];

interface VolumeHeatmapProps extends DataRefreshProps {
  cells: HeatmapCell[];
  referencePrice?: number;
  exchange?: HeatmapExchange;
  onExchangeChange?: (exchange: HeatmapExchange) => void;
  loading?: boolean;
  collectedAt?: string | null;
}

function formatUsdPrice(price: number): string {
  if (price >= 100_000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function DepthBar({ bidPct, askPct }: { bidPct: number; askPct: number }) {
  return (
    <div className="flex h-5 flex-1 items-stretch overflow-hidden rounded-md bg-surface-hover/80">
      <div
        className="bg-emerald-600/75 transition-all"
        style={{ width: `${bidPct}%` }}
        title={`買い ${bidPct}%`}
      />
      <div className="w-1 shrink-0 bg-black" aria-hidden />
      <div
        className="bg-red-600/75 transition-all"
        style={{ width: `${askPct}%` }}
        title={`売り ${askPct}%`}
      />
    </div>
  );
}

function SummaryBar({ bidPct, askPct }: { bidPct: number; askPct: number }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex min-w-[3.5rem] items-center gap-1.5">
        <span className="flex h-7 w-7 items-center justify-center rounded border border-emerald-500/60 font-english text-xs font-bold text-emerald-400">
          B
        </span>
        <span className="font-english text-sm font-semibold text-emerald-400">{bidPct}%</span>
      </div>
      <DepthBar bidPct={bidPct} askPct={askPct} />
      <div className="flex min-w-[3.5rem] items-center justify-end gap-1.5">
        <span className="font-english text-sm font-semibold text-red-400">{askPct}%</span>
        <span className="flex h-7 w-7 items-center justify-center rounded border border-red-500/60 font-english text-xs font-bold text-red-400">
          S
        </span>
      </div>
    </div>
  );
}

export function VolumeHeatmap({
  cells,
  referencePrice = 0,
  exchange = "all",
  onExchangeChange,
  loading = false,
  collectedAt,
  onRefresh,
  refreshing,
}: VolumeHeatmapProps) {
  const { rows, bidPct, askPct, priceLow, priceHigh } = useMemo(() => {
    if (!cells.length) {
      return { rows: [], bidPct: 50, askPct: 50, priceLow: 0, priceHigh: 0 };
    }

    const sorted = [...cells].sort((a, b) => b.price_bin - a.price_bin);
    const totalBid = cells.reduce((s, c) => s + c.bid_depth, 0);
    const totalAsk = cells.reduce((s, c) => s + c.ask_depth, 0);
    const total = totalBid + totalAsk || 1;
    const bid = Math.round((totalBid / total) * 100);
    const ask = 100 - bid;

    let display = sorted;
    if (referencePrice > 0) {
      const near = sorted
        .filter((c) => Math.abs(c.price_bin - referencePrice) / referencePrice <= 0.06)
        .slice(0, 14);
      display = near.length >= 6 ? near : sorted.slice(0, 14);
    } else {
      display = sorted.slice(0, 14);
    }

    return {
      rows: display,
      bidPct: bid,
      askPct: ask,
      priceLow: Math.min(...display.map((c) => c.price_bin)),
      priceHigh: Math.max(...display.map((c) => c.price_bin)),
    };
  }, [cells, referencePrice]);

  const heatmapSourceHref =
    exchange !== "all" && EXCHANGE_URLS[exchange]
      ? EXCHANGE_URLS[exchange]
      : EXTERNAL_LINKS.whitebit;
  const heatmapSourceLabel =
    exchange !== "all"
      ? (HEATMAP_EXCHANGES.find((e) => e.value === exchange)?.label ?? "取引所")
      : "WhiteBIT";

  if (!cells.length) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <DataPanelMeta
          title="板厚みヒートマップ"
          sourceHref={heatmapSourceHref}
          sourceLabel={heatmapSourceLabel}
          updatedAt={collectedAt}
          onRefresh={onRefresh}
          refreshing={refreshing || loading}
          refreshLabel="板厚みを更新"
          headerActions={
            onExchangeChange ? (
              <select
                value={exchange}
                onChange={(e) => onExchangeChange(e.target.value as HeatmapExchange)}
                className="min-h-[36px] rounded-lg border border-surface-border bg-surface px-2 py-1 font-japanese text-xs text-slate-200"
                aria-label="取引所を選択"
              >
                {HEATMAP_EXCHANGES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : undefined
          }
        />
        <p className="text-sm text-content-muted">{loading ? "読み込み中…" : "データなし"}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <DataPanelMeta
        title="板厚みヒートマップ"
        subtitle="価格帯ごとの買い（B）・売り（S）の厚み（USD建て取引所）"
        sourceHref={heatmapSourceHref}
        sourceLabel={heatmapSourceLabel}
        updatedAt={collectedAt}
        onRefresh={onRefresh}
        refreshing={refreshing || loading}
        refreshLabel="板厚みを更新"
        headerActions={
          onExchangeChange ? (
            <select
              value={exchange}
              onChange={(e) => onExchangeChange(e.target.value as HeatmapExchange)}
              className="min-h-[36px] rounded-lg border border-surface-border bg-surface px-2 py-1 font-japanese text-xs text-slate-200"
              aria-label="取引所を選択"
            >
              {HEATMAP_EXCHANGES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      <SummaryBar bidPct={bidPct} askPct={askPct} />

      <div className="mb-2 flex items-center justify-between font-japanese text-[10px] text-content-muted">
        <span>高値 ${formatUsdPrice(priceHigh)}</span>
        {referencePrice > 0 && (
          <span className="text-accent-blue">現値 ${formatUsdPrice(referencePrice)}</span>
        )}
        <span>安値 ${formatUsdPrice(priceLow)}</span>
      </div>

      <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
        {rows.map((cell) => {
          const total = cell.bid_depth + cell.ask_depth;
          const bid = Math.round((cell.bid_depth / (total + 0.001)) * 100);
          const ask = 100 - bid;
          const nearRef =
            referencePrice > 0 &&
            Math.abs(cell.price_bin - referencePrice) / referencePrice < 0.008;

          return (
            <div
              key={cell.price_bin}
              className={`grid grid-cols-[4.75rem_1fr] items-center gap-2 rounded-md px-1 py-0.5 ${
                nearRef ? "bg-accent-blue/10 ring-1 ring-accent-blue/30" : ""
              }`}
            >
              <span
                className={`text-right font-english text-xs ${
                  nearRef ? "font-semibold text-white" : "text-content-secondary"
                }`}
              >
                ${formatUsdPrice(cell.price_bin)}
              </span>
              <DepthBar bidPct={bid} askPct={ask} />
            </div>
          );
        })}
      </div>

      <p className="mt-3 font-japanese text-[10px] leading-relaxed text-content-muted">
        上ほど高い価格帯。緑=買い板 / 赤=売り板。青枠は現値付近です。
      </p>
    </div>
  );
}
