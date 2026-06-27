import type { AccuracySummary } from "../../types/market";

interface AccuracyPanelProps {
  data: AccuracySummary | null;
  loading: boolean;
}

const OUTCOME_LABEL = {
  win: { text: "TP到達 100%", color: "text-accent-green" },
  loss: { text: "0%", color: "text-accent-red" },
  partial: { text: "方向のみ 80%", color: "text-accent-amber" },
  pending: { text: "集計中", color: "text-slate-400" },
  neutral: { text: "様子見", color: "text-slate-500" },
} as const;

export function AccuracyPanel({ data, loading }: AccuracyPanelProps) {
  if (loading) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h2 className="text-sm font-medium text-slate-400">AI分析の的中率（7日スイング）</h2>
        <p className="mt-3 text-sm text-slate-500">評価中…</p>
      </section>
    );
  }

  if (!data || data.total === 0) {
    return (
      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h2 className="text-sm font-medium text-slate-400">AI分析の的中率（7日スイング）</h2>
        <p className="mt-3 text-sm text-slate-500">
          直近7日以内にシナリオを保存すると、保存から7日間の TP/SL・トレンドをここで集計します。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h2 className="mb-1 text-sm font-medium text-slate-400">AI分析の的中率（7日スイング）</h2>
      <p className="mb-4 text-xs text-slate-500">
        直近7日以内の保存を対象。各保存は保存日時から7日間で評価（確定 {data.finalized_count} 件 / 集計中{" "}
        {data.pending_count} 件）
      </p>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">大トレンド的中率</p>
          <p className="font-english text-2xl font-semibold text-slate-100">
            {data.direction_accuracy_pct != null ? `${data.direction_accuracy_pct}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">エントリー带到達率</p>
          <p className="font-english text-2xl font-semibold text-slate-100">
            {data.entry_zone_reach_pct != null ? `${data.entry_zone_reach_pct}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">TP/SLスコア平均</p>
          <p className="font-english text-2xl font-semibold text-slate-100">
            {data.win_rate_pct != null ? `${data.win_rate_pct}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">対象件数</p>
          <p className="font-english text-2xl font-semibold text-slate-100">{data.total}</p>
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
              <span className="text-slate-500">
                帯:{ev.entry_zone_reached ? "到達" : "未達"}
                {ev.status === "pending" && ev.days_remaining > 0
                  ? ` · あと${ev.days_remaining}日`
                  : ev.swing_score_pct != null
                    ? ` · ${ev.swing_score_pct}%`
                    : ""}
              </span>
              <span className={outcome.color}>{outcome.text}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
        TP到達=100% / 方向のみ=80% / SL・逆転=0%。保存から7日未満は集計中。1時間足の高安値で TP/SL
        到達を判定しています。
      </p>
    </section>
  );
}
