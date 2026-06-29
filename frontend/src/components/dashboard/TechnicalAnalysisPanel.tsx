import type { TechnicalAnalysis } from "../../types/market";
import { candleIntervalLabel, type CandleInterval } from "../../lib/candle-interval";
import { EXTERNAL_LINKS } from "../../lib/external-links";
import { ExternalLink } from "../ui/ExternalLink";

interface TechnicalAnalysisPanelProps {
  data: TechnicalAnalysis | null;
  interval?: CandleInterval;
}

function intervalTitle(interval: string): string {
  return candleIntervalLabel(interval as CandleInterval);
}

function intervalTag(interval: string): string {
  return interval === "1d" ? "1D" : interval.toUpperCase();
}

export function TechnicalAnalysisPanel({ data, interval = "4h" }: TechnicalAnalysisPanelProps) {
  const activeInterval = data?.interval ?? interval;
  const title = intervalTitle(activeInterval);
  const tag = intervalTag(activeInterval);

  if (!data) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="mb-3 text-sm font-medium text-content-secondary">テクニカル分析（{title}）</h3>
        <p className="text-sm text-content-muted">データなし</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-content-secondary">テクニカル分析（{title}）</h3>
        <ExternalLink href={EXTERNAL_LINKS.tradingView}>TradingView</ExternalLink>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-content-muted">RSI(14)</dt>
          <dd className="font-english text-slate-200">{data.rsi_14?.toFixed(1) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-content-muted">EMA200（{tag}）</dt>
          <dd className="font-english text-violet-300">
            {data.ema_200 ? `$${data.ema_200.toLocaleString()}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-content-muted">EMA20</dt>
          <dd className="font-english text-slate-200">
            {data.ema_20 ? `$${data.ema_20.toLocaleString()}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-content-muted">EMA50</dt>
          <dd className="font-english text-slate-200">
            {data.ema_50 ? `$${data.ema_50.toLocaleString()}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-content-muted">BB上限</dt>
          <dd className="font-english text-slate-300">
            {data.bollinger ? `$${data.bollinger.upper.toLocaleString()}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-content-muted">BB下限</dt>
          <dd className="font-english text-slate-300">
            {data.bollinger ? `$${data.bollinger.lower.toLocaleString()}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-content-muted">MACD</dt>
          <dd className="font-english text-slate-200">
            {data.macd ? data.macd.histogram.toFixed(2) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-content-muted">サポ / レジ</dt>
          <dd className="font-english text-xs text-slate-300">
            {data.support && data.resistance
              ? `$${data.support.toLocaleString()} / $${data.resistance.toLocaleString()}`
              : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-content-muted">{data.summary_ja}</p>
      {data.stoch_summary_ja ? (
        <p className="mt-2 font-japanese text-xs leading-relaxed text-content-muted">
          <span className="text-content-secondary">Stoch: </span>
          {data.stoch_summary_ja}
        </p>
      ) : null}
    </div>
  );
}
