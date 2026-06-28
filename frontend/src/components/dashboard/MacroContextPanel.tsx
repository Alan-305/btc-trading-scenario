import type { MacroContextSnapshot } from "../../types/scenario";
import { ExternalLink } from "../ui/ExternalLink";
import { MacroSignalBadge, MacroSummaryText, MACRO_STANCE_STYLE } from "./macro/MacroCommentary";
import { EtfFlowChart } from "./macro/EtfFlowChart";
import { OnChainChart } from "./macro/OnChainChart";
import { DvolChart, PutCallOiChart } from "./macro/OptionsCharts";

interface MacroContextPanelProps {
  data: MacroContextSnapshot | null;
  loading?: boolean;
  error?: string | null;
}

export function MacroContextPanel({ data, loading, error }: MacroContextPanelProps) {
  if (loading && !data) {
    return (
      <div id="macro-environment" className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="font-japanese text-sm font-medium text-slate-400">マクロ環境（ETF・オプション・オンチェーン）</h3>
        <p className="mt-3 text-sm text-slate-500">グラフを読み込み中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div id="macro-environment" className="rounded-xl border border-accent-amber/40 bg-accent-amber/5 p-5">
        <h3 className="font-japanese text-sm font-medium text-amber-200">マクロ環境（ETF・オプション・オンチェーン）</h3>
        <p className="mt-3 text-sm text-amber-100/90">{error}</p>
      </div>
    );
  }

  if (!data || (!data.options && !data.etf_flows && !data.onchain)) {
    return (
      <div id="macro-environment" className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="font-japanese text-sm font-medium text-slate-400">マクロ環境（ETF・オプション・オンチェーン）</h3>
        <p className="mt-3 text-sm text-slate-500">データを取得できませんでした。「再分析」をお試しください。</p>
      </div>
    );
  }

  const { options, etf_flows, onchain } = data;
  const overallStyle = MACRO_STANCE_STYLE[data.overall_stance ?? "neutral"];

  return (
    <section id="macro-environment" className="space-y-4">
      <header className="rounded-xl border border-surface-border bg-surface-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-japanese text-base font-medium text-slate-200">マクロ環境</h3>
            <p className="mt-1 font-japanese text-[11px] text-slate-500">
              ETF資金・Deribitオプション・オンチェーン（シナリオ分析に反映）
            </p>
          </div>
          <MacroSignalBadge
            signalJa={data.overall_signal_ja ?? "様子見"}
            stance={data.overall_stance}
          />
        </div>
        {data.overall_summary_ja && (
          <p className={`mt-3 font-japanese text-sm font-medium ${overallStyle.color}`}>
            総合: {data.overall_signal_ja ?? overallStyle.text}
          </p>
        )}
        <MacroSummaryText summary={data.overall_summary_ja ?? ""} />
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {etf_flows && (
          <article className="rounded-xl border border-surface-border bg-surface-card p-5">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-japanese text-sm font-medium text-slate-200">米国BTC ETF フロー</h4>
                <p className="mt-0.5 font-japanese text-[10px] text-slate-500">
                  {etf_flows.source === "coinglass" ? "Coinglass" : "Yahoo出来高×価格変動"}の推定
                </p>
              </div>
              <MacroSignalBadge signalJa={etf_flows.signal_ja ?? "様子見"} stance={etf_flows.stance} />
            </header>
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
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-english text-sm font-semibold text-slate-200">Deribit Options</h4>
                <p className="mt-0.5 font-japanese text-[10px] text-slate-500">
                  Put/Call OI・DVOL（ボラティリティ指数）
                </p>
              </div>
              <div className="flex items-center gap-2">
                <MacroSignalBadge signalJa={options.signal_ja ?? "様子見"} stance={options.stance} />
                <ExternalLink href="https://www.deribit.com/statistics/BTC/options-data" className="text-xs">
                  Deribit
                </ExternalLink>
              </div>
            </header>
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
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-japanese text-sm font-medium text-slate-200">オンチェーン</h4>
                <p className="mt-0.5 font-japanese text-[10px] text-slate-500">
                  blockchain.info + mempool.space
                </p>
              </div>
              <div className="flex items-center gap-2">
                <MacroSignalBadge signalJa={onchain.signal_ja ?? "様子見"} stance={onchain.stance} />
                <ExternalLink href="https://www.blockchain.com/charts" className="text-xs">
                  charts
                </ExternalLink>
              </div>
            </header>
            <OnChainChart
              hashRateHistory={onchain.hash_rate_history ?? []}
              txCountHistory={onchain.tx_count_history ?? []}
              hashRateChange7d={onchain.hash_rate_change_7d_pct}
              activityTrend={onchain.activity_trend}
            />
            <p className="mt-2 font-japanese text-[10px] text-slate-600">
              手数料（速い） {onchain.mempool_fast_fee_sat ?? "—"} sat/vB
            </p>
            <MacroSummaryText summary={onchain.summary_ja ?? ""} />
          </article>
        )}
      </div>

      <p className="px-1 font-japanese text-[10px] leading-relaxed text-slate-600">
        参考情報であり投資助言ではありません。ETFフローは推定値です。
      </p>
    </section>
  );
}
