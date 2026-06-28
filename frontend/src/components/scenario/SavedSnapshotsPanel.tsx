import type { SavedSnapshotRecord } from "../../lib/firestore-snapshots";
import { CollapsibleSection } from "../ui/CollapsibleSection";

const TREND_LABEL = {
  bullish: "上昇寄り",
  bearish: "下降寄り",
  range: "レンジ",
} as const;

interface SavedSnapshotsPanelProps {
  records: SavedSnapshotRecord[];
  loading: boolean;
}

function formatSavedAt(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SavedSnapshotsPanel({ records, loading }: SavedSnapshotsPanelProps) {
  const summary =
    records.length > 0
      ? `全 ${records.length} 件（最大1年分）`
      : loading
        ? "読み込み中…"
        : "保存なし";

  return (
    <CollapsibleSection
      title="保存履歴"
      subtitle="「シナリオを保存」で記録した分析の一覧"
      summary={summary}
      defaultExpanded={false}
    >
      {loading ? (
        <p className="text-sm text-slate-500">読み込み中…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-slate-500">
          「シナリオを保存」で、この分析を Firestore に記録できます。
        </p>
      ) : (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {records.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-border/60 bg-surface px-3 py-2 text-sm"
            >
              <span className="text-slate-400">{formatSavedAt(row.saved_at)}</span>
              <span className="font-english text-slate-200">
                {row.market_summary.whitebit_price
                  ? `$${parseFloat(row.market_summary.whitebit_price).toLocaleString()}`
                  : "—"}
              </span>
              <span className="text-slate-300">
                {row.scenario?.macro_trend
                  ? (TREND_LABEL[row.scenario.macro_trend] ?? row.scenario.macro_trend)
                  : "—"}
              </span>
              <span className="text-xs text-slate-500">
                信頼度{" "}
                {row.scenario?.confidence != null
                  ? `${(row.scenario.confidence * 100).toFixed(0)}%`
                  : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
  );
}
