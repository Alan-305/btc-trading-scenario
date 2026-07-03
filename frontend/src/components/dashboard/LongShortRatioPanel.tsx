import type { CoinglassSnapshot } from "../../types/scenario";
import type { DataRefreshProps } from "../../types/data-refresh";
import { EXTERNAL_LINKS } from "../../lib/external-links";
import { longShortRatioSignal } from "../../lib/indicator-signals";
import { DataPanelMeta } from "../ui/DataPanelMeta";
import { MacroSignalBadge } from "./macro/MacroCommentary";

interface LongShortRatioPanelProps extends DataRefreshProps {
  data: CoinglassSnapshot | null;
  loading?: boolean;
}

function formatRatio(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toFixed(2);
}

function formatChange(value: number | null | undefined): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function changeTone(value: number | null | undefined): string {
  if (value == null) return "text-slate-300";
  if (value >= 0.15) return "text-rose-300";
  if (value <= -0.15) return "text-emerald-300";
  return "text-slate-300";
}

export function LongShortRatioPanel({
  data,
  loading = false,
  onRefresh,
  refreshing,
}: LongShortRatioPanelProps) {
  const signal = longShortRatioSignal(data);
  const hasData =
    data != null &&
    (data.long_short_ratio != null ||
      data.long_short_position_ratio != null ||
      data.top_trader_long_short_ratio != null);

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <DataPanelMeta
        title="ロング／ショート比率"
        subtitle="一般口座・建玉・大口の偏りと24時間の変化（逆張り警戒）"
        sourceHref={EXTERNAL_LINKS.binanceFutures}
        sourceLabel="Binance"
        updatedAt={data?.timestamp}
        onRefresh={onRefresh}
        refreshing={refreshing || loading}
        refreshLabel="L/S比率を更新"
        headerActions={<MacroSignalBadge signalJa={signal.signalJa} stance={signal.stance} />}
      />

      {!hasData ? (
        <p className="font-japanese text-sm text-content-muted">
          {loading ? "読み込み中…" : "ロング／ショート比率のデータがありません。"}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="font-japanese text-xs text-content-muted">一般口座 L/S</dt>
              <dd className="font-english text-cyan-300">{formatRatio(data.long_short_ratio)}</dd>
            </div>
            <div>
              <dt className="font-japanese text-xs text-content-muted">建玉 L/S</dt>
              <dd className="font-english text-orange-300">
                {formatRatio(data.long_short_position_ratio)}
              </dd>
            </div>
            <div>
              <dt className="font-japanese text-xs text-content-muted">大口 L/S</dt>
              <dd className="font-english text-violet-300">
                {formatRatio(data.top_trader_long_short_ratio)}
              </dd>
            </div>
            <div>
              <dt className="font-japanese text-xs text-content-muted">24h変化</dt>
              <dd className={`font-english ${changeTone(data.long_short_ratio_change_24h)}`}>
                {formatChange(data.long_short_ratio_change_24h)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 font-japanese text-xs leading-relaxed text-content-secondary">
            {data.long_short_summary_ja || signal.summaryJa}
          </p>
          <p className="mt-2 font-japanese text-[11px] leading-relaxed text-content-muted">
            1.0が均衡です。1.2超はロング偏り、0.85未満はショート偏りとして警戒します。一般と大口が逆向きのときは様子見を優先します。
          </p>
        </>
      )}
    </section>
  );
}
