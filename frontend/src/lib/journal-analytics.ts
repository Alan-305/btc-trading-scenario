import type { AccuracySummary, PredictionEvaluation } from "../types/market";
import type { JournalEntry } from "../types/journal";
import type { SavedSnapshotRecord } from "./firestore-snapshots";
import { isActualTrade } from "./journal-utils";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function summarizeEvaluations(
  evaluations: PredictionEvaluation[],
): Omit<AccuracySummary, "evaluations"> {
  let trendHits = 0;
  let trendTotal = 0;
  let entryHits = 0;
  let entryTotal = 0;
  const swingScores: number[] = [];
  let pendingCount = 0;
  let finalizedCount = 0;

  for (const ev of evaluations) {
    if (ev.status === "pending") {
      pendingCount += 1;
      continue;
    }
    finalizedCount += 1;
    if (ev.entry_zone_reached != null) {
      entryTotal += 1;
      if (ev.entry_zone_reached) entryHits += 1;
    }
    if (ev.trend_correct != null) {
      trendTotal += 1;
      if (ev.trend_correct) trendHits += 1;
    }
    if (ev.swing_score_pct != null && ev.outcome !== "neutral") {
      swingScores.push(ev.swing_score_pct);
    }
  }

  return {
    total: evaluations.length,
    evaluated: finalizedCount,
    pending_count: pendingCount,
    finalized_count: finalizedCount,
    direction_accuracy_pct: trendTotal ? round1((trendHits / trendTotal) * 100) : null,
    entry_zone_reach_pct: entryTotal ? round1((entryHits / entryTotal) * 100) : null,
    win_rate_pct: swingScores.length
      ? round1(swingScores.reduce((a, b) => a + b, 0) / swingScores.length)
      : null,
  };
}

export function tradeSnapshotIds(entries: JournalEntry[]): Set<string> {
  return new Set(
    entries.filter(isActualTrade).map((e) => e.snapshotId).filter((id): id is string => id != null),
  );
}

export function filterAccuracyBySnapshotIds(
  summary: AccuracySummary,
  savedRecords: SavedSnapshotRecord[],
  snapshotIds: Set<string>,
): AccuracySummary | null {
  const filteredEvaluations = summary.evaluations.filter((_, index) => {
    const record = savedRecords[index];
    return record != null && snapshotIds.has(record.id);
  });
  if (filteredEvaluations.length === 0) return null;
  return {
    ...summarizeEvaluations(filteredEvaluations),
    evaluations: filteredEvaluations,
  };
}

export interface TagStat {
  tag: string;
  tradeCount: number;
  finalizedCount: number;
  avgScorePct: number | null;
  directionAccuracyPct: number | null;
}

export function buildTagStats(
  journalEntries: JournalEntry[],
  summary: AccuracySummary,
  savedRecords: SavedSnapshotRecord[],
): TagStat[] {
  const tagToSnapshots = new Map<string, Set<string>>();

  for (const entry of journalEntries) {
    if (!isActualTrade(entry) || !entry.snapshotId) continue;
    for (const tag of entry.tags) {
      const normalized = tag.trim();
      if (!normalized) continue;
      if (!tagToSnapshots.has(normalized)) tagToSnapshots.set(normalized, new Set());
      tagToSnapshots.get(normalized)!.add(entry.snapshotId);
    }
  }

  const stats: TagStat[] = [];
  for (const [tag, snapshotIds] of tagToSnapshots) {
    const filtered = filterAccuracyBySnapshotIds(summary, savedRecords, snapshotIds);
    if (!filtered) continue;
    stats.push({
      tag,
      tradeCount: filtered.total,
      finalizedCount: filtered.finalized_count,
      avgScorePct: filtered.win_rate_pct,
      directionAccuracyPct: filtered.direction_accuracy_pct,
    });
  }

  return stats.sort((a, b) => b.tradeCount - a.tradeCount);
}

export function averageReviewScore(entries: JournalEntry[]): number | null {
  const scores = entries.map((e) => e.reviewScore).filter((s): s is number => s != null);
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

export function actualTradePnlStats(entries: JournalEntry[]): {
  closedCount: number;
  avgPnlPct: number | null;
  winCount: number;
} {
  const closed = entries.filter(
    (e) => e.type === "entry" && e.status === "closed" && e.entryPrice != null && e.exitPrice != null,
  );
  const pnls = closed
    .map((e) => {
      if (e.side === "long") return ((e.exitPrice! - e.entryPrice!) / e.entryPrice!) * 100;
      if (e.side === "short") return ((e.entryPrice! - e.exitPrice!) / e.entryPrice!) * 100;
      return null;
    })
    .filter((v): v is number => v != null);

  return {
    closedCount: closed.length,
    avgPnlPct: pnls.length ? round1(pnls.reduce((a, b) => a + b, 0) / pnls.length) : null,
    winCount: pnls.filter((p) => p > 0).length,
  };
}
