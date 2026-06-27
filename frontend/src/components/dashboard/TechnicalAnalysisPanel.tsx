import type { TechnicalAnalysis } from "../../types/market";
import { EXTERNAL_LINKS } from "../../lib/external-links";
import { ExternalLink } from "../ui/ExternalLink";

const TREND_LABEL = {
  bullish: { text: "上昇", color: "text-accent-green" },
  bearish: { text: "下降", color: "text-accent-red" },
  neutral: { text: "中立", color: "text-slate-400" },
  range: { text: "レンジ", color: "text-accent-amber" },
};

interface TechnicalAnalysisPanelProps {
  data: TechnicalAnalysis | null;
}

export function TechnicalAnalysisPanel({ data }: TechnicalAnalysisPanelProps) {
  if (!data) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="mb-3 text-sm font-medium text-slate-400">テクニカル分析（4H）</h3>
        <p className="text-sm text-slate-500">データなし</p>
      </div>
    );
  }

  const trend = TREND_LABEL[data.trend] ?? TREND_LABEL.neutral;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-400">テクニカル分析（4H）</h3>
        <ExternalLink href={EXTERNAL_LINKS.tradingView}>TradingView</ExternalLink>
      </div>
      <p className={`mb-3 text-sm font-medium ${trend.color}`}>総合: {trend.text}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-slate-500">RSI(14)</dt>
          <dd className="font-english text-slate-200">{data.rsi_14?.toFixed(1) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">EMA200（4H）</dt>
          <dd className="font-english text-violet-300">
            {data.ema_200 ? `$${data.ema_200.toLocaleString()}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">EMA20</dt>
          <dd className="font-english text-slate-200">
            {data.ema_20 ? `$${data.ema_20.toLocaleString()}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">EMA50</dt>
          <dd className="font-english text-slate-200">
            {data.ema_50 ? `$${data.ema_50.toLocaleString()}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">BB上限</dt>
          <dd className="font-english text-slate-300">
            {data.bollinger ? `$${data.bollinger.upper.toLocaleString()}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">BB下限</dt>
          <dd className="font-english text-slate-300">
            {data.bollinger ? `$${data.bollinger.lower.toLocaleString()}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">MACD</dt>
          <dd className="font-english text-slate-200">
            {data.macd ? data.macd.histogram.toFixed(2) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">サポ / レジ</dt>
          <dd className="font-english text-xs text-slate-300">
            {data.support && data.resistance
              ? `$${data.support.toLocaleString()} / $${data.resistance.toLocaleString()}`
              : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{data.summary_ja}</p>
    </div>
  );
}
