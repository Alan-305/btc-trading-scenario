import type { SavedSnapshotRecord } from "../../lib/firestore-snapshots";

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
  if (loading) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h2 className="text-sm font-medium text-slate-400">保存履歴</h2>
        <p className="mt-3 text-sm text-slate-500">読み込み中…</p>
      </section>
    );
  }

  if (records.length === 0) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h2 className="text-sm font-medium text-slate-400">保存履歴</h2>
        <p className="mt-3 text-sm text-slate-500">
          「シナリオを保存」で、この分析を Firestore に記録できます。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h2 className="mb-3 text-sm font-medium text-slate-400">保存履歴（直近7日）</h2>
      <ul className="space-y-2">
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
    </section>
  );
}
