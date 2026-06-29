import type { EquityIndexSnapshot, GlobalEquitySnapshot } from "../../../types/scenario";
import { MacroSignalBadge } from "./MacroCommentary";

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function MiniSparkline({ history }: { history: { value: number }[] }) {
  if (history.length < 2) return null;
  const values = history.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 72;
  const h = 28;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const up = values[values.length - 1] >= values[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-[72px]" aria-hidden>
      <polyline
        fill="none"
        stroke={up ? "#34d399" : "#f87171"}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

interface EquityMarketsPanelProps {
  data: GlobalEquitySnapshot | null | undefined;
  loading?: boolean;
}

export function EquityMarketsPanel({ data, loading }: EquityMarketsPanelProps) {
  if (loading && !data) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="font-japanese text-sm font-medium text-content-secondary">世界株指数</h3>
        <p className="mt-3 text-sm text-content-muted">読み込み中…</p>
      </div>
    );
  }

  if (!data?.markets?.length) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="font-japanese text-sm font-medium text-content-secondary">世界株指数</h3>
        <p className="mt-3 text-sm text-content-muted">株価指数データを取得できませんでした。</p>
      </div>
    );
  }

  return (
    <section id="equity-markets" className="rounded-xl border border-surface-border bg-surface-card p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-japanese text-base font-medium text-slate-200">世界株指数</h3>
          <p className="mt-1 font-japanese text-[11px] text-content-muted">
            米国・日本・欧州の主要指数（Yahoo Finance）— リスクオン/offはBTCに波及しやすいです
          </p>
        </div>
        {data.signal_ja ? (
          <MacroSignalBadge signalJa={data.signal_ja} stance={data.stance} />
        ) : null}
      </header>
      {data.summary_ja ? (
        <p className="mb-4 font-japanese text-xs leading-relaxed text-content-muted">{data.summary_ja}</p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {data.markets.map((market: EquityIndexSnapshot) => {
          const ch1 = market.change_1d_pct;
          const chColor =
            ch1 == null ? "text-content-muted" : ch1 > 0 ? "text-accent-green" : ch1 < 0 ? "text-accent-red" : "text-content-muted";
          return (
            <article
              key={market.market_id}
              className="rounded-lg border border-surface-border/70 bg-surface-elevated/40 p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-japanese text-xs font-medium text-slate-300">{market.name_ja}</h4>
                  <p className="mt-0.5 font-english text-lg font-semibold text-white">
                    {formatPrice(market.last_price)}
                  </p>
                </div>
                <MiniSparkline history={market.history} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <dt className="text-content-muted">前日比</dt>
                  <dd className={`font-english font-medium ${chColor}`}>{formatPct(ch1)}</dd>
                </div>
                <div>
                  <dt className="text-content-muted">5日</dt>
                  <dd className="font-english font-medium text-slate-200">{formatPct(market.change_5d_pct)}</dd>
                </div>
              </dl>
              {market.signal_ja ? (
                <p className="mt-2 font-japanese text-[10px] leading-relaxed text-content-muted">
                  {market.summary_ja || market.signal_ja}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
