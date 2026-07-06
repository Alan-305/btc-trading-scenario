import type {
  DirectionalScenario,
  ScenarioHorizonBundle,
  ScenarioHorizonId,
  ScenarioResponse,
  TradeBranch,
} from "../types/scenario";

export function recommendedBranch(scenario: ScenarioResponse): TradeBranch {
  return scenario.macro_trend === "bearish" ? "bearish" : "bullish";
}

export function isWatchRecommended(scenario: ScenarioResponse): boolean {
  return scenario.macro_trend === "range";
}

export type PrimaryRecommendation = TradeBranch | "watch";

export function primaryRecommendation(scenario: ScenarioResponse): PrimaryRecommendation {
  if (isWatchRecommended(scenario)) return "watch";
  return recommendedBranch(scenario);
}

export const PRIMARY_LABEL: Record<PrimaryRecommendation, string> = {
  bullish: "上昇シナリオ",
  bearish: "下落シナリオ",
  watch: "様子見",
};

export function resolveDirectionalScenario(
  scenario: ScenarioResponse,
  branch: TradeBranch,
): DirectionalScenario | null {
  const direct = branch === "bullish" ? scenario.bullish : scenario.bearish;
  if (direct) return direct;

  if (scenario.macro_trend === branch) {
    return {
      macro_trend: branch,
      confidence: scenario.confidence,
      entry: scenario.entry,
      exit: scenario.exit,
      forecast: scenario.forecast,
      scenario_text_ja: scenario.scenario_text_ja,
      horizons: scenario.horizons,
    };
  }

  return null;
}

export function resolveHorizons(
  directional: DirectionalScenario | null,
): ScenarioHorizonBundle[] {
  if (!directional) return [];
  if (directional.horizons?.length) return directional.horizons;
  return [
    {
      id: "today",
      label: "本日のシナリオ",
      period_hint: "約6時間",
      entry: directional.entry,
      exit: directional.exit,
      forecast: directional.forecast,
      scenario_text_ja: directional.scenario_text_ja,
    },
  ];
}

export function resolveActiveHorizon(
  directional: DirectionalScenario | null,
  activeHorizonId: ScenarioHorizonId,
): ScenarioHorizonBundle | null {
  const horizons = resolveHorizons(directional);
  return horizons.find((h) => h.id === activeHorizonId) ?? horizons[0] ?? null;
}
