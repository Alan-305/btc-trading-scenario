import { summarizeEvaluations } from "./journal-analytics";
import type { AccuracySummary, PredictionEvaluation } from "../types/market";
import type { SavedSnapshotRecord } from "./firestore-snapshots";

export type AccuracyPeriodId = "7d" | "30d" | "365d";

export interface AccuracyPeriodDef {
  id: AccuracyPeriodId;
  label: string;
  reachLabel: string;
  days: number;
}

export const ACCURACY_PERIODS: AccuracyPeriodDef[] = [
  { id: "7d", label: "過去7日間", reachLabel: "週間到達率", days: 7 },
  { id: "30d", label: "過去1ヶ月", reachLabel: "月間到達率", days: 30 },
  { id: "365d", label: "過去1年", reachLabel: "年間到達率", days: 365 },
];

export interface AccuracyPeriodSummary {
  period: AccuracyPeriodDef;
  total: number;
  finalized_count: number;
  pending_count: number;
  direction_accuracy_pct: number | null;
  entry_zone_reach_pct: number | null;
  win_rate_pct: number | null;
}

export function filterEvaluationsByDays(
  evaluations: PredictionEvaluation[],
  savedRecords: SavedSnapshotRecord[],
  days: number,
): PredictionEvaluation[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return evaluations.filter((_, index) => {
    const savedAt = savedRecords[index]?.saved_at;
    return savedAt != null && savedAt.getTime() >= cutoff;
  });
}

export function buildAccuracyPeriodSummaries(
  summary: AccuracySummary,
  savedRecords: SavedSnapshotRecord[],
): AccuracyPeriodSummary[] {
  return ACCURACY_PERIODS.map((period) => {
    const filtered = filterEvaluationsByDays(summary.evaluations, savedRecords, period.days);
    const stats = summarizeEvaluations(filtered);
    return {
      period,
      ...stats,
    };
  });
}

export function formatAccuracyHeaderSummary(
  periods: AccuracyPeriodSummary[],
): string | undefined {
  const week = periods.find((p) => p.period.id === "7d");
  if (!week || week.total === 0) return undefined;
  const reach = week.entry_zone_reach_pct;
  const dir = week.direction_accuracy_pct;
  const parts: string[] = [`7日間 ${week.total} 件`];
  if (reach != null) parts.push(`週間到達率 ${reach}%`);
  if (dir != null) parts.push(`方向 ${dir}%`);
  return parts.join(" · ");
}
