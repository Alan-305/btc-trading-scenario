import type { ScenarioResponse } from "../../types/scenario";

const TREND_LABEL = {
  bullish: { text: "上昇寄り", color: "text-accent-green" },
  bearish: { text: "下降寄り", color: "text-accent-red" },
  range: { text: "レンジ", color: "text-accent-amber" },
};

interface ScenarioCardProps {
  scenario: ScenarioResponse;
}

export function ScenarioCard({ scenario }: ScenarioCardProps) {
  const trend = TREND_LABEL[scenario.macro_trend];

  return (
    <article className="rounded-xl border border-surface-border bg-surface-card p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-100">本日のシナリオ</h2>
        <span className={`text-sm font-medium ${trend.color}`}>{trend.text}</span>
      </header>
      <p className="whitespace-pre-wrap break-words font-japanese leading-relaxed text-slate-300">
        {scenario.scenario_text_ja}
      </p>
      <footer className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>信頼度: {(scenario.confidence * 100).toFixed(0)}%</span>
        <span>{scenario.disclaimer}</span>
      </footer>
    </article>
  );
}
