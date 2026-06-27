import type { AccuracySummary } from "../../types/market";

interface AccuracyPanelProps {
  data: AccuracySummary | null;
  loading: boolean;
}

const OUTCOME_LABEL = {
  win: { text: "的中", color: "text-accent-green" },
  loss: { text: "外れ", color: "text-accent-red" },
  partial: { text: "方向のみ", color: "text-accent-amber" },
  pending: { text: "判定中", color: "text-slate-400" },
  neutral: { text: "様子見", color: "text-slate-500" },
} as const;

export function AccuracyPanel({ data, loading }: AccuracyPanelProps) {
  if (loading) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h2 className="text-sm font-medium text-slate-400">AI分析の的中率</h2>
        <p className="mt-3 text-sm text-slate-500">評価中…</p>
      </section>
    );
  }

  if (!data || data.total === 0) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h2 className="text-sm font-medium text-slate-400">AI分析の的中率</h2>
        <p className="mt-3 text-sm text-slate-500">
          シナリオを保存すると、現在価格との照合結果がここに表示されます。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h2 className="mb-4 text-sm font-medium text-slate-400">AI分析の的中率</h2>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">方向的中率</p>
          <p className="font-english text-2xl font-semibold text-slate-100">
            {data.direction_accuracy_pct != null ? `${data.direction_accuracy_pct}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">勝率（TP/SL基準）</p>
          <p className="font-english text-2xl font-semibold text-slate-100">
            {data.win_rate_pct != null ? `${data.win_rate_pct}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">評価件数</p>
          <p className="font-english text-2xl font-semibold text-slate-100">{data.evaluated}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {data.evaluations.map((ev, i) => {
          const outcome = OUTCOME_LABEL[ev.outcome];
          return (
            <li
              key={ev.saved_at ?? i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-border/60 px-3 py-2 text-xs"
            >
              <span className="text-slate-400">{ev.predicted_trend}</span>
              <span className="font-english text-slate-300">
                ${ev.reference_price.toLocaleString()} → ${ev.current_price.toLocaleString()}
                <span className={ev.price_change_pct >= 0 ? "text-accent-green" : "text-accent-red"}>
                  {" "}
                  ({ev.price_change_pct >= 0 ? "+" : ""}
                  {ev.price_change_pct}%)
                </span>
              </span>
              <span className={outcome.color}>{outcome.text}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[10px] text-slate-600">
        保存時点の予測と現在価格を照合した参考値です。短期の保存ほど判定精度は低くなります。
      </p>
    </section>
  );
}
