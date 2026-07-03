import type { TechnicalAnalysis } from "../../types/market";
import type { DataRefreshProps } from "../../types/data-refresh";
import {
  CANDLE_INTERVAL_OPTIONS,
  candleIntervalLabel,
  type CandleInterval,
} from "../../lib/candle-interval";
import { EXTERNAL_LINKS } from "../../lib/external-links";
import { ichimokuSignal } from "../../lib/indicator-signals";
import { DataPanelMeta } from "../ui/DataPanelMeta";
import { MacroSignalBadge } from "./macro/MacroCommentary";

interface IchimokuPanelProps extends DataRefreshProps {
  data: TechnicalAnalysis | null;
  interval: CandleInterval;
  onIntervalChange: (interval: CandleInterval) => void;
  loading?: boolean;
}

function cloudLabel(vs: string | null | undefined): string {
  if (vs === "above") return "雲の上";
  if (vs === "below") return "雲の下";
  if (vs === "inside") return "雲の中";
  return "—";
}

export function IchimokuPanel({
  data,
  interval,
  onIntervalChange,
  loading = false,
  onRefresh,
  refreshing,
}: IchimokuPanelProps) {
  const signal = ichimokuSignal(data);
  const activeInterval = (data?.interval ?? interval) as CandleInterval;
  const title = `一目均衡表（${candleIntervalLabel(activeInterval)}）`;

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <DataPanelMeta
        title={title}
        subtitle="三役好転＝買い環境・三役逆転＝売り環境（転換線×基準線・雲・遅行）"
        sourceHref={EXTERNAL_LINKS.tradingView}
        sourceLabel="TradingView"
        updatedAt={data?.fetched_at}
        onRefresh={onRefresh}
        refreshing={refreshing || loading}
        refreshLabel="一目均衡表を更新"
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <MacroSignalBadge signalJa={signal.signalJa} stance={signal.stance} />
            <label className="flex items-center gap-2 font-japanese text-xs text-content-muted">
              <span>足</span>
              <select
                value={interval}
                onChange={(e) => onIntervalChange(e.target.value as CandleInterval)}
                disabled={loading}
                className="min-h-[36px] rounded-lg border border-surface-border bg-surface px-2 py-1 text-sm text-slate-200"
              >
                {CANDLE_INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      />

      {!data || data.ichimoku_tenkan == null || data.ichimoku_kijun == null ? (
        <p className="font-japanese text-sm text-content-muted">
          {loading ? "読み込み中…" : "一目均衡表の計算に十分なローソク足がありません。"}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-japanese text-xs text-content-muted">転換線</dt>
              <dd className="font-english text-cyan-300">
                ${data.ichimoku_tenkan.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-japanese text-xs text-content-muted">基準線</dt>
              <dd className="font-english text-orange-300">
                ${data.ichimoku_kijun.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-japanese text-xs text-content-muted">雲の位置</dt>
              <dd className="font-japanese text-slate-200">{cloudLabel(data.ichimoku_price_vs_cloud)}</dd>
            </div>
            <div>
              <dt className="font-japanese text-xs text-content-muted">先行スパンA</dt>
              <dd className="font-english text-slate-300">
                {data.ichimoku_senkou_a != null ? `$${data.ichimoku_senkou_a.toLocaleString()}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-japanese text-xs text-content-muted">先行スパンB</dt>
              <dd className="font-english text-slate-300">
                {data.ichimoku_senkou_b != null ? `$${data.ichimoku_senkou_b.toLocaleString()}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-japanese text-xs text-content-muted">三役</dt>
              <dd className="font-japanese text-slate-200">
                {data.ichimoku_signal === "sanyaku_kouten"
                  ? "三役好転"
                  : data.ichimoku_signal === "sanyaku_gyakuten"
                    ? "三役逆転"
                    : `${data.ichimoku_roles_met ?? 0}/3 一致`}
              </dd>
            </div>
          </dl>
          <p className="mt-4 font-japanese text-xs leading-relaxed text-content-secondary">
            {data.ichimoku_summary_ja || signal.summaryJa}
          </p>
        </>
      )}
    </section>
  );
}
