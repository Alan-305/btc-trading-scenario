import type { AccuracySummary } from "../../types/market";
import type { JournalEntry } from "../../types/journal";
import type { SavedSnapshotRecord } from "../../lib/firestore-snapshots";
import {
  actualTradePnlStats,
  averageReviewScore,
  buildTagStats,
  filterAccuracyBySnapshotIds,
  tradeSnapshotIds,
} from "../../lib/journal-analytics";

interface JournalAnalyticsPanelProps {
  aiAccuracy: AccuracySummary | null;
  journalEntries: JournalEntry[];
  savedRecords: SavedSnapshotRecord[];
  loading: boolean;
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-english text-xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function AccuracyBlock({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: AccuracySummary | null;
}) {
  if (!data || data.total === 0) {
    return (
      <div className="rounded-lg border border-surface-border/60 p-4">
        <h3 className="text-xs font-medium text-slate-400">{title}</h3>
        <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
        <p className="mt-2 text-sm text-slate-500">対象データがありません</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-surface-border/60 p-4">
      <h3 className="text-xs font-medium text-slate-400">{title}</h3>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-600">{subtitle}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricBlock
          label="大トレンド的中率"
          value={data.direction_accuracy_pct != null ? `${data.direction_accuracy_pct}%` : "—"}
        />
        <MetricBlock
          label="エントリー带到達率"
          value={data.entry_zone_reach_pct != null ? `${data.entry_zone_reach_pct}%` : "—"}
        />
        <MetricBlock
          label="TP/SLスコア平均"
          value={data.win_rate_pct != null ? `${data.win_rate_pct}%` : "—"}
        />
        <MetricBlock label="対象件数" value={String(data.total)} />
      </div>
      <p className="mt-2 text-[10px] text-slate-600">
        確定 {data.finalized_count} 件 / 集計中 {data.pending_count} 件
      </p>
    </div>
  );
}

export function JournalAnalyticsPanel({
  aiAccuracy,
  journalEntries,
  savedRecords,
  loading,
}: JournalAnalyticsPanelProps) {
  if (loading) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h2 className="text-sm font-medium text-slate-400">実トレード分析（7日スイング）</h2>
        <p className="mt-3 text-sm text-slate-500">集計中…</p>
      </section>
    );
  }

  const tradeIds = tradeSnapshotIds(journalEntries);
  const tradeAccuracy =
    aiAccuracy && tradeIds.size > 0
      ? filterAccuracyBySnapshotIds(aiAccuracy, savedRecords, tradeIds)
      : null;
  const tagStats = aiAccuracy ? buildTagStats(journalEntries, aiAccuracy, savedRecords) : [];
  const pnlStats = actualTradePnlStats(journalEntries);
  const reviewAvg = averageReviewScore(
    journalEntries.filter((e) => e.reviewScore != null),
  );

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h2 className="mb-1 text-sm font-medium text-slate-400">実トレード分析（7日スイング）</h2>
      <p className="mb-4 text-xs text-slate-500">
        日誌で「エントリー」かつ AI 連携済みの記録だけを実トレードとして集計します。
      </p>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AccuracyBlock
          title="AI 全体（参考）"
          subtitle="直近7日の保存シナリオすべて"
          data={aiAccuracy}
        />
        <AccuracyBlock
          title="実トレードのみ"
          subtitle="日誌でエントリー記録した AI 連携シナリオ"
          data={tradeAccuracy}
        />
      </div>

      {(pnlStats.closedCount > 0 || tagStats.length > 0 || reviewAvg != null) && (
        <div className="space-y-4">
          {reviewAvg != null && (
            <div className="rounded-lg border border-surface-border/60 p-4">
              <h3 className="text-xs font-medium text-slate-400">振り返りスコア平均</h3>
              <p className="mt-1 text-[10px] text-slate-600">日誌に記録した自己評価（1〜5）の平均</p>
              <p className="mt-2 font-english text-2xl font-semibold text-slate-100">
                {reviewAvg} / 5
              </p>
            </div>
          )}

          {pnlStats.closedCount > 0 && (
            <div className="rounded-lg border border-surface-border/60 p-4">
              <h3 className="text-xs font-medium text-slate-400">手入力の決済損益</h3>
              <p className="mt-1 text-[10px] text-slate-600">
                日誌に記録した Entry / Exit 価格から算出（決済済み {pnlStats.closedCount} 件）
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricBlock
                  label="平均損益"
                  value={
                    pnlStats.avgPnlPct != null
                      ? `${pnlStats.avgPnlPct >= 0 ? "+" : ""}${pnlStats.avgPnlPct}%`
                      : "—"
                  }
                />
                <MetricBlock
                  label="勝ち"
                  value={`${pnlStats.winCount} / ${pnlStats.closedCount}`}
                />
              </div>
            </div>
          )}

          {tagStats.length > 0 && (
            <div className="rounded-lg border border-surface-border/60 p-4">
              <h3 className="mb-3 text-xs font-medium text-slate-400">タグ別成績（実トレード）</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-surface-border/60 text-slate-500">
                      <th className="pb-2 pr-3 font-normal">タグ</th>
                      <th className="pb-2 pr-3 font-normal">件数</th>
                      <th className="pb-2 pr-3 font-normal">トレンド的中</th>
                      <th className="pb-2 font-normal">TP/SL平均</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagStats.map((row) => (
                      <tr key={row.tag} className="border-b border-surface-border/40">
                        <td className="py-2 pr-3 font-japanese text-slate-300">#{row.tag}</td>
                        <td className="py-2 pr-3 font-english text-slate-400">
                          {row.tradeCount}
                          {row.finalizedCount < row.tradeCount && (
                            <span className="text-slate-600"> ({row.finalizedCount}確定)</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 font-english text-slate-300">
                          {row.directionAccuracyPct != null ? `${row.directionAccuracyPct}%` : "—"}
                        </td>
                        <td className="py-2 font-english text-slate-300">
                          {row.avgScorePct != null ? `${row.avgScorePct}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tradeIds.size === 0 && (
        <p className="text-xs text-slate-500">
          AI 連携の日誌を「エントリー」に変更するか、「実トレードとして記録」で集計対象にできます。
        </p>
      )}
    </section>
  );
}
