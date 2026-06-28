import { useState } from "react";
import type { ScenarioHorizonBundle, ScenarioHorizonId, ScenarioResponse } from "../../types/scenario";

const TREND_LABEL = {
  bullish: { text: "上昇寄り", color: "text-accent-green" },
  bearish: { text: "下降寄り", color: "text-accent-red" },
  range: { text: "レンジ", color: "text-accent-amber" },
};

interface ScenarioCardProps {
  scenario: ScenarioResponse;
  activeHorizonId: ScenarioHorizonId;
  onHorizonChange: (id: ScenarioHorizonId) => void;
}

function resolveHorizons(scenario: ScenarioResponse): ScenarioHorizonBundle[] {
  if (scenario.horizons?.length) return scenario.horizons;
  return [
    {
      id: "today",
      label: "本日のシナリオ",
      period_hint: "約6時間",
      entry: scenario.entry,
      exit: scenario.exit,
      forecast: scenario.forecast,
      scenario_text_ja: scenario.scenario_text_ja,
    },
  ];
}

export function ScenarioCard({ scenario, activeHorizonId, onHorizonChange }: ScenarioCardProps) {
  const trend = TREND_LABEL[scenario.macro_trend];
  const horizons = resolveHorizons(scenario);
  const active =
    horizons.find((h) => h.id === activeHorizonId) ?? horizons[0];

  return (
    <article className="rounded-xl border border-surface-border bg-surface-card p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-100">{active.label}</h2>
          <p className="mt-1 text-xs text-slate-500">{active.period_hint}</p>
        </div>
        <span className={`text-sm font-medium ${trend.color}`}>{trend.text}</span>
      </header>

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
                : "border border-surface-border text-slate-400 hover:border-slate-500"
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
        <p className="mt-3 text-xs text-slate-500">
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
      <footer className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>信頼度: {(scenario.confidence * 100).toFixed(0)}%</span>
        <span>{scenario.disclaimer}</span>
      </footer>
    </article>
  );
}

export function useScenarioHorizon(scenario: ScenarioResponse | null) {
  const [activeHorizonId, setActiveHorizonId] = useState<ScenarioHorizonId>("today");

  const activeHorizon =
    scenario?.horizons?.find((h) => h.id === activeHorizonId) ??
    scenario?.horizons?.[0] ??
    (scenario
      ? {
          id: "today" as const,
          label: "本日のシナリオ",
          period_hint: "約6時間",
          entry: scenario.entry,
          exit: scenario.exit,
          forecast: scenario.forecast,
          scenario_text_ja: scenario.scenario_text_ja,
        }
      : null);

  return { activeHorizonId, setActiveHorizonId, activeHorizon };
}
