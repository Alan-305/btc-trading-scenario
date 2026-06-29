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

const BRANCH_LABEL: Record<TradeBranch, { text: string; color: string }> = {
  bullish: { text: "上昇シナリオ", color: "text-accent-green" },
  bearish: { text: "下落シナリオ", color: "text-accent-red" },
};

interface ScenarioCardProps {
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
}: ScenarioCardProps) {
  const directional = resolveDirectionalScenario(scenario, activeBranch);
  const horizons = resolveHorizons(directional);
  const active = horizons.find((h) => h.id === activeHorizonId) ?? horizons[0];
  const branchMeta = BRANCH_LABEL[activeBranch];
  const recommended = recommendedBranch(scenario);
  const watchPrimary = isWatchRecommended(scenario);

  if (!directional || !active) {
    return null;
  }

  return (
    <article className="rounded-xl border border-surface-border bg-surface-card p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-100">{active.label}</h2>
          <p className="mt-1 text-xs text-content-muted">{active.period_hint}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-sm font-medium ${branchMeta.color}`}>{branchMeta.text}</span>
          {!watchPrimary && activeBranch === recommended ? (
            <span className="text-[10px] text-content-muted">いまのおすすめ</span>
          ) : null}
        </div>
      </header>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="トレードシナリオ">
        {(["bullish", "bearish"] as const).map((branch) => (
          <button
            key={branch}
            type="button"
            role="tab"
            aria-selected={branch === activeBranch}
            onClick={() => onBranchChange(branch)}
            className={`min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium transition ${
              branch === activeBranch
                ? branch === "bullish"
                  ? "bg-accent-green/25 text-accent-green"
                  : "bg-accent-red/25 text-accent-red"
                : "border border-surface-border text-content-secondary hover:border-content-muted"
            }`}
          >
            {BRANCH_LABEL[branch].text}
            {!watchPrimary && branch === recommended ? " ★" : ""}
          </button>
        ))}
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
                ? "bg-accent-blue text-white"
                : "border border-surface-border text-content-secondary hover:border-content-muted"
            }`}
          >
            {h.id === "today"
              ? "本日"
              : h.id === "week"
                ? "今週"
                : h.id === "month"
                  ? "今月"
                  : "半減期"}
          </button>
        ))}
      </div>

      <p className="whitespace-pre-wrap break-words font-japanese leading-relaxed text-slate-300">
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
