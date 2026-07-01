import type { MacroContextSnapshot } from "../../types/scenario";
import type { DataRefreshProps } from "../../types/data-refresh";
import { EXTERNAL_LINKS } from "../../lib/external-links";
import { DataPanelMeta } from "../ui/DataPanelMeta";
import { MacroSignalBadge, MacroSummaryText } from "./macro/MacroCommentary";
import { EtfFlowChart } from "./macro/EtfFlowChart";
import { OnChainChart } from "./macro/OnChainChart";
import { DvolChart, PutCallOiChart } from "./macro/OptionsCharts";

interface MacroContextPanelProps extends DataRefreshProps {
  data: MacroContextSnapshot | null;
  loading?: boolean;
  error?: string | null;
}

function etfSourceLink(source: string | undefined): { href: string; label: string } {
  if (source === "coinglass") {
    return { href: EXTERNAL_LINKS.coinglass, label: "Coinglass" };
  }
  return { href: EXTERNAL_LINKS.yahooFinance, label: "Yahoo Finance" };
}

export function MacroContextPanel({
  data,
  loading,
  error,
  onRefresh,
  refreshing,
}: MacroContextPanelProps) {
  if (loading && !data) {
    return (
      <div id="macro-environment" className="rounded-xl border border-surface-border bg-surface-card p-5">
        <DataPanelMeta title="マクロ環境（ETF・オプション・オンチェーン）" />
        <p className="mt-3 text-sm text-content-muted">グラフを読み込み中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div id="macro-environment" className="rounded-xl border border-accent-amber/40 bg-accent-amber/5 p-5">
        <DataPanelMeta title="マクロ環境（ETF・オプション・オンチェーン）" titleClassName="font-japanese text-sm font-medium text-amber-200" />
        <p className="mt-3 text-sm text-amber-100/90">{error}</p>
      </div>
    );
  }

  if (!data || (!data.options && !data.etf_flows && !data.onchain && !data.usdt_dominance && !data.equity_markets)) {
    return (
      <div id="macro-environment" className="rounded-xl border border-surface-border bg-surface-card p-5">
        <DataPanelMeta title="マクロ環境（ETF・オプション・オンチェーン）" />
        <p className="mt-3 text-sm text-content-muted">データを取得できませんでした。「再分析」をお試しください。</p>
      </div>
    );
  }

  const { options, etf_flows, onchain } = data;
  const etfLink = etfSourceLink(etf_flows?.source);

  return (
    <section id="macro-environment" className="space-y-4">
      <header className="rounded-xl border border-surface-border bg-surface-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <DataPanelMeta
              title="マクロ環境"
              subtitle="ETF資金・Deribitオプション・オンチェーン・USDT.D（シナリオ分析に反映）"
              updatedAt={data.fetched_at}
              onRefresh={onRefresh}
              refreshing={refreshing}
              refreshLabel="マクロ環境を更新"
              className="mb-0"
            />
          </div>
          <MacroSignalBadge
            signalJa={data.overall_signal_ja ?? "様子見"}
            stance={data.overall_stance}
          />
        </div>
        <MacroSummaryText summary={data.overall_summary_ja ?? ""} />
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {etf_flows && (
          <article className="rounded-xl border border-surface-border bg-surface-card p-5">
            <DataPanelMeta
              title="米国BTC ETF フロー"
              subtitle={
                etf_flows.source === "coinglass" ? "Coinglass" : "Yahoo出来高×価格変動"
              }
              sourceHref={etfLink.href}
              sourceLabel={etfLink.label}
              updatedAt={etf_flows.timestamp}
              onRefresh={onRefresh}
              refreshing={refreshing}
              refreshLabel="ETFフローを更新"
              headerActions={
                <MacroSignalBadge signalJa={etf_flows.signal_ja ?? "様子見"} stance={etf_flows.stance} />
              }
            />
            <EtfFlowChart
              dailyFlows={etf_flows.daily_flows ?? []}
              trend={etf_flows.trend}
              netFlow3d={etf_flows.net_flow_3d_usd}
            />
            <MacroSummaryText summary={etf_flows.summary_ja ?? ""} />
          </article>
        )}

        {options && (
          <article className="rounded-xl border border-surface-border bg-surface-card p-5">
            <DataPanelMeta
              title={<span className="font-english text-sm font-semibold text-slate-200">Deribit Options</span>}
              subtitle="Put/Call OI・DVOL（ボラティリティ指数）"
              sourceHref={EXTERNAL_LINKS.deribit}
              sourceLabel="Deribit"
              updatedAt={options.timestamp}
              onRefresh={onRefresh}
              refreshing={refreshing}
              refreshLabel="オプションを更新"
              headerActions={
                <MacroSignalBadge signalJa={options.signal_ja ?? "様子見"} stance={options.stance} />
              }
            />
            <PutCallOiChart
              putOi={options.put_open_interest}
              callOi={options.call_open_interest}
              ratio={options.put_call_ratio}
            />
            <div className="mt-5 border-t border-surface-border/60 pt-4">
              <DvolChart history={options.dvol_history ?? []} current={options.dvol_index} />
            </div>
            <MacroSummaryText summary={options.summary_ja ?? ""} />
          </article>
        )}

        {onchain && (
          <article className="rounded-xl border border-surface-border bg-surface-card p-5">
            <DataPanelMeta
              title="オンチェーン"
              subtitle="blockchain.info + mempool.space"
              sourceHref={EXTERNAL_LINKS.blockchainCharts}
              sourceLabel="blockchain.com"
              updatedAt={onchain.timestamp}
              onRefresh={onRefresh}
              refreshing={refreshing}
              refreshLabel="オンチェーンを更新"
              headerActions={
                <MacroSignalBadge signalJa={onchain.signal_ja ?? "様子見"} stance={onchain.stance} />
              }
            />
            <OnChainChart
              hashRateHistory={onchain.hash_rate_history ?? []}
              txCountHistory={onchain.tx_count_history ?? []}
              hashRateChange7d={onchain.hash_rate_change_7d_pct}
              activityTrend={onchain.activity_trend}
            />
            <p className="mt-2 font-japanese text-[10px] text-content-muted">
              手数料（速い） {onchain.mempool_fast_fee_sat ?? "—"} sat/vB ·{" "}
              <a
                href={EXTERNAL_LINKS.mempool}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-blue hover:underline"
              >
                mempool.space
              </a>
            </p>
            <MacroSummaryText summary={onchain.summary_ja ?? ""} />
          </article>
        )}
      </div>

      <p className="px-1 font-japanese text-[10px] leading-relaxed text-content-muted">
        参考情報であり投資助言ではありません。ETFフローは推定値です。
      </p>
    </section>
  );
}
