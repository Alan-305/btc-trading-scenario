import type {
  CyclePeakTarget,
  HoldBuyZone,
  HoldScenarioContext,
  HorizonMode,
  ScenarioHorizonId,
} from "../types/scenario";

export type { CyclePeakTarget, HoldBuyZone, HoldScenarioContext, HorizonMode };

export function normalizeHorizonId(id: string): ScenarioHorizonId {
  if (id === "hodl" || id === "halving" || id === "month") return "hodl";
  if (id === "week") return "week";
  return "today";
}

export function isHodlHorizon(
  id: ScenarioHorizonId,
  mode?: HorizonMode,
): boolean {
  return id === "hodl" || mode === "hodl";
}
