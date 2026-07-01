import type {
  ScenarioHorizonId,
  ScenarioResponse,
  TradeBranch,
} from "../../types/scenario";
import {
  isWatchRecommended,
  recommendedBranch,
  resolveDirectionalScenario,
  resolveHorizons,
} from "../../lib/scenario-branches";
import { isHodlHorizon } from "../../lib/scenario-horizons";
import { EXTERNAL_LINKS } from "../../lib/external-links";
import { DataSourceActions } from "../ui/DataPanelMeta";
import type { DataRefreshProps } from "../../types/data-refresh";
import { HoldScenarioPanel } from "./HoldScenarioPanel";
import { MtfSummaryPanel } from "./MtfSummaryPanel";

const BRANCH_LABEL: Record<TradeBranch, { text: string; color: string }> = {
  bullish: { text: "上昇シナリオ", color: "text-accent-green" },
  bearish: { text: "下落シナリオ", color: "text-accent-red" },
};

function branchTabClass(active: boolean, watchPrimary: boolean): string {
  if (watchPrimary) {
    return active
      ? "bg-surface-elevated text-content-secondary ring-1 ring-accent-amber/30"
      : "border border-surface-border/60 text-content-muted hover:border-accent-amber/25 hover:text-content-secondary";
  }
  return active
    ? "bg-accent-green/25 text-accent-green"
    : "border border-surface-border text-content-secondary hover:border-content-muted";
}

function branchTabClassBearish(active: boolean, watchPrimary: boolean): string {
  if (watchPrimary) {
    return branchTabClass(active, true);
  }
  return active
    ? "bg-accent-red/25 text-accent-red"
    : "border border-surface-border text-content-secondary hover:border-content-muted";
}

interface ScenarioCardProps extends DataRefreshProps {
  scenario: ScenarioResponse;
  activeBranch: TradeBranch;
  onBranchChange: (branch: TradeBranch) => void;
  activeHorizonId: ScenarioHorizonId;
  onHorizonChange: (id: ScenarioHorizonId) => void;
  /** 様子見カードがこのカードより上に表示されているとき true */
  watchScenarioAbove?: boolean;
}

export function ScenarioCard({
  scenario,
  activeBranch,
  onBranchChange,
  activeHorizonId,
  onHorizonChange,
  onRefresh,
  refreshing,
  watchScenarioAbove = false,
}: ScenarioCardProps) {
  const directional = resolveDirectionalScenario(scenario, activeBranch);
  const horizons = resolveHorizons(directional);
  const active = horizons.find((h) => h.id === activeHorizonId) ?? horizons[0];
  const branchMeta = BRANCH_LABEL[activeBranch];
  const recommended = recommendedBranch(scenario);
  const watchPrimary = isWatchRecommended(scenario);
  const isHodl = isHodlHorizon(active.id, active.horizon_mode);

  if (!directional || !active) {
    return null;
  }

  const watchLinkLabel = watchScenarioAbove ? "上の様子見シナリオ" : "様子見シナリオ";

  return (
    <article
      className={`rounded-xl border bg-surface-card p-6 ${
        watchPrimary ? "border-surface-border/80 opacity-95" : "border-surface-border"
      }`}
    >
      {watchPrimary ? (
        <div className="mb-4 rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2.5">
          <p className="font-japanese text-xs leading-relaxed text-amber-100/90">
            指標が拮抗しており、いまは
            <span className="font-medium text-amber-200"> 様子見 </span>
            がおすすめです。
            <a
              href="#watch-scenario"
              className="ml-1 font-medium text-accent-amber underline decoration-accent-amber/50 underline-offset-2 hover:text-amber-200"
            >
              {watchLinkLabel}
            </a>
            を先にご確認ください。下の上昇・下落は参考です。
          </p>
        </div>
      ) : null}

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-100">
            {active.label}
            {watchPrimary ? (
              <span className="ml-2 font-japanese text-xs font-normal text-content-muted">
                （参考）
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-xs text-content-muted">{active.period_hint}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <DataSourceActions
            sourceHref={EXTERNAL_LINKS.whitebit}
            sourceLabel="WhiteBIT"
            onRefresh={onRefresh}
            refreshing={refreshing}
            refreshLabel="シナリオを再分析"
            updatedAt={scenario.generated_at}
          />
          <span
            className={`text-sm font-medium ${
              watchPrimary ? "text-content-muted" : branchMeta.color
            }`}
          >
            {watchPrimary ? `${branchMeta.text}（参考）` : branchMeta.text}
          </span>
          {!watchPrimary && activeBranch === recommended ? (
            <span className="text-[10px] text-content-muted">いまのおすすめ</span>
          ) : null}
        </div>
      </header>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="トレードシナリオ">
        {(["bullish", "bearish"] as const).map((branch) => {
          const isActive = branch === activeBranch;
          const tabClass =
            branch === "bullish"
              ? branchTabClass(isActive, watchPrimary)
              : branchTabClassBearish(isActive, watchPrimary);
          return (
            <button
              key={branch}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onBranchChange(branch)}
              className={`min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium transition ${tabClass}`}
            >
              {watchPrimary ? `${BRANCH_LABEL[branch].text}（参考）` : BRANCH_LABEL[branch].text}
              {!watchPrimary && branch === recommended ? " ★" : ""}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="シナリオ期間">
        {horizons.map((h) => (
          <button
            key={h.id}
            type="button"
            role="tab"
            aria-selected={h.id === active.id}
            onClick={() => onHorizonChange(h.id)}
            className={`min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium transition ${
              h.id === active.id
                ? watchPrimary
                  ? "bg-surface-elevated text-content-secondary ring-1 ring-surface-border"
                  : h.id === "hodl"
                    ? "bg-violet-600 text-white"
                    : "bg-accent-blue text-white"
                : "border border-surface-border text-content-secondary hover:border-content-muted"
            }`}
          >
            {h.id === "today" ? "本日" : h.id === "week" ? "今週" : "ガチホ"}
          </button>
        ))}
      </div>

      {isHodl && active.hold_context ? (
        <HoldScenarioPanel context={active.hold_context} />
      ) : null}

      {!isHodl && scenario.mtf ? (
        <MtfSummaryPanel
          mtf={scenario.mtf}
          updatedAt={scenario.generated_at}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      ) : null}

      <p
        className={`mt-4 whitespace-pre-wrap break-words font-japanese leading-relaxed ${
          watchPrimary ? "text-content-muted" : "text-slate-300"
        }`}
      >
        {active.scenario_text_ja}
      </p>

      {scenario.data_sources && (
        <p className="mt-3 text-xs text-content-muted">
          統合データ: テクニカル
          {scenario.data_sources.includes_risk_zones ? "・リスクゾーン" : ""}
          {scenario.data_sources.includes_sessions ? "・セッション" : ""}
          {scenario.data_sources.includes_heatmap ? "・板" : ""}
          {scenario.data_sources.includes_derivatives ? "・デリバティブ" : ""}
          {scenario.data_sources.includes_options ? "・オプション" : ""}
          {scenario.data_sources.includes_etf_flows ? "・ETF" : ""}
          {scenario.data_sources.includes_onchain ? "・オンチェーン" : ""}
          {scenario.data_sources.includes_mtf ? "・MTF" : ""}
          {scenario.data_sources.research_items_used > 0
            ? `・調査メモ ${scenario.data_sources.research_items_used} 件`
            : ""}
        </p>
      )}
      <footer className="mt-4 flex items-center justify-between text-xs text-content-muted">
        <span>信頼度: {(directional.confidence * 100).toFixed(0)}%</span>
        <span>{scenario.disclaimer}</span>
      </footer>
    </article>
  );
}
