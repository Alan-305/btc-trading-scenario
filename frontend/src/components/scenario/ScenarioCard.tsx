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

function branchTabClass(active: boolean, recommended: boolean, demoted: boolean): string {
  if (demoted && !active) {
    return "border border-surface-border/50 text-content-muted hover:border-surface-border";
  }
  if (active && recommended) {
    return "bg-accent-green/25 text-accent-green ring-1 ring-accent-green/30";
  }
  if (active) {
    return "bg-surface-elevated text-content-secondary ring-1 ring-surface-border";
  }
  return "border border-surface-border text-content-secondary hover:border-content-muted";
}

function branchTabClassBearish(active: boolean, recommended: boolean, demoted: boolean): string {
  if (demoted && !active) {
    return branchTabClass(active, recommended, demoted);
  }
  if (active && recommended) {
    return "bg-accent-red/25 text-accent-red ring-1 ring-accent-red/30";
  }
  if (active) {
    return "bg-surface-elevated text-content-secondary ring-1 ring-surface-border";
  }
  return "border border-surface-border text-content-secondary hover:border-content-muted";
}

interface ScenarioCardProps extends DataRefreshProps {
  scenario: ScenarioResponse;
  activeBranch: TradeBranch;
  onBranchChange: (branch: TradeBranch) => void;
  activeHorizonId: ScenarioHorizonId;
  onHorizonChange: (id: ScenarioHorizonId) => void;
}

export function ScenarioCard({
  scenario,
  activeBranch,
  onBranchChange,
  activeHorizonId,
  onHorizonChange,
  onRefresh,
  refreshing,
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

  const demoted = watchPrimary;

  return (
    <article
      className={`rounded-xl border bg-surface-card p-5 ${
        demoted ? "border-surface-border/70 opacity-90" : "border-surface-border"
      }`}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-japanese text-base font-medium text-slate-200">
            {demoted ? "参考シナリオ（詳細）" : "シナリオ詳細"}
          </h2>
          <p className="mt-1 font-japanese text-xs text-content-muted">
            {active.label} · {active.period_hint}
          </p>
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
            className={`font-japanese text-xs font-medium ${
              demoted ? "text-content-muted" : branchMeta.color
            }`}
          >
            {branchMeta.text}
            {!demoted && activeBranch === recommended ? " ★" : ""}
          </span>
        </div>
      </header>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="トレードシナリオ">
        {(["bullish", "bearish"] as const).map((branch) => {
          const isActive = branch === activeBranch;
          const isRecommended = branch === recommended && !watchPrimary;
          const tabClass =
            branch === "bullish"
              ? branchTabClass(isActive, isRecommended, demoted)
              : branchTabClassBearish(isActive, isRecommended, demoted);
          return (
            <button
              key={branch}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onBranchChange(branch)}
              className={`min-h-[44px] rounded-lg px-3 py-2 font-japanese text-xs font-medium transition ${tabClass}`}
            >
              {BRANCH_LABEL[branch].text}
              {isRecommended ? " ★" : ""}
              {demoted ? "（参考）" : ""}
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
            className={`min-h-[44px] rounded-lg px-3 py-2 font-japanese text-xs font-medium transition ${
              h.id === active.id
                ? demoted
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
        className={`mt-4 whitespace-pre-wrap break-words font-japanese text-sm leading-relaxed ${
          demoted ? "text-content-muted" : "text-slate-300"
        }`}
      >
        {active.scenario_text_ja}
      </p>

      {scenario.data_sources && (
        <p className="mt-3 font-japanese text-xs text-content-muted">
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
      <footer className="mt-4 flex items-center justify-between font-japanese text-xs text-content-muted">
        <span>信頼度: {(directional.confidence * 100).toFixed(0)}%</span>
        <span>{scenario.disclaimer}</span>
      </footer>
    </article>
  );
}
