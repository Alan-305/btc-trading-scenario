import { useMemo } from "react";
import type { AccuracySummary } from "../../types/market";
import type { SavedSnapshotRecord } from "../../lib/firestore-snapshots";
import {
  buildAccuracyPeriodSummaries,
  formatAccuracyHeaderSummary,
  type AccuracyPeriodSummary,
} from "../../lib/accuracy-periods";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { DataUpdatedAt } from "../ui/DataPanelMeta";
import { ExternalLink } from "../ui/ExternalLink";
import { EXTERNAL_LINKS } from "../../lib/external-links";

interface AccuracyPanelProps {
  data: AccuracySummary | null;
  loading: boolean;
  savedRecords?: SavedSnapshotRecord[];
  priceUpdatedAt?: string | null;
}

const OUTCOME_LABEL = {
  win: { text: "TP到達 100%", color: "text-accent-green" },
  loss: { text: "0%", color: "text-accent-red" },
  partial: { text: "方向のみ 80%", color: "text-accent-amber" },
  pending: { text: "集計中", color: "text-content-secondary" },
  neutral: { text: "様子見", color: "text-content-muted" },
} as const;

function PeriodCard({ row }: { row: AccuracyPeriodSummary }) {
  const { period } = row;
  return (
    <article className="rounded-lg border border-surface-border/60 bg-surface-elevated/40 p-4">
      <h3 className="mb-3 font-japanese text-xs font-medium text-slate-300">{period.label}</h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-[10px] text-content-muted">{period.reachLabel}</dt>
          <dd className="font-english text-xl font-semibold text-accent-blue">
            {row.entry_zone_reach_pct != null ? `${row.entry_zone_reach_pct}%` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-content-muted">方向的中率</dt>
          <dd className="font-english text-xl font-semibold text-slate-100">
            {row.direction_accuracy_pct != null ? `${row.direction_accuracy_pct}%` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-content-muted">TP/SLスコア</dt>
          <dd className="font-english text-xl font-semibold text-slate-100">
            {row.win_rate_pct != null ? `${row.win_rate_pct}%` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-content-muted">対象</dt>
          <dd className="font-english text-xl font-semibold text-slate-100">
            {row.total}
            <span className="ml-1 text-xs font-normal text-content-muted">
              (確定 {row.finalized_count})
            </span>
          </dd>
        </div>
      </dl>
      {row.total === 0 && (
        <p className="mt-2 text-[10px] text-content-muted">この期間の保存データはありません。</p>
      )}
    </article>
  );
}

export function AccuracyPanel({
  data,
  loading,
  savedRecords = [],
  priceUpdatedAt,
}: AccuracyPanelProps) {
  const periods = useMemo(
    () => (data ? buildAccuracyPeriodSummaries(data, savedRecords) : []),
    [data, savedRecords],
  );
  const headerSummary = formatAccuracyHeaderSummary(periods);

  if (loading) {
    return (
      <CollapsibleSection
        title="AI分析の的中率"
        subtitle="保存シナリオの7日スイング評価を期間別に集計"
        summary="評価中…"
      >
        <p className="text-sm text-content-muted">評価中…</p>
      </CollapsibleSection>
    );
  }

  if (!data || data.total === 0) {
    return (
      <CollapsibleSection
        title="AI分析の的中率"
        subtitle="保存シナリオの7日スイング評価を期間別に集計"
        summary="保存データなし"
      >
        <p className="text-sm text-content-muted">
          シナリオを保存すると、保存から7日間の TP/SL・トレンド・エントリー带到達を期間別に集計します。
        </p>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="AI分析の的中率"
      subtitle="各保存は保存日時から7日間で評価（1時間足の高安値で判定）"
      summary={headerSummary}
    >
      <div className="space-y-3">
        {periods.map((row) => (
          <PeriodCard key={row.period.id} row={row} />
        ))}
      </div>
      {priceUpdatedAt ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <DataUpdatedAt value={priceUpdatedAt} className="mt-0" />
          <ExternalLink href={EXTERNAL_LINKS.whitebit} className="text-xs">
            WhiteBIT
          </ExternalLink>
        </div>
      ) : null}

      <h3 className="mb-2 mt-5 font-japanese text-xs font-medium text-content-secondary">直近の評価一覧</h3>
      <ul className="space-y-2">
        {data.evaluations.slice(0, 20).map((ev, i) => {
          const outcome = OUTCOME_LABEL[ev.outcome];
          return (
            <li
              key={ev.saved_at ?? i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-border/60 px-3 py-2 text-xs"
            >
              <span className="text-content-secondary">{ev.predicted_trend}</span>
              <span className="font-english text-slate-300">
                ${ev.reference_price.toLocaleString()} → ${ev.current_price.toLocaleString()}
                <span className={ev.price_change_pct >= 0 ? "text-accent-green" : "text-accent-red"}>
                  {" "}
                  ({ev.price_change_pct >= 0 ? "+" : ""}
                  {ev.price_change_pct}%)
                </span>
              </span>
              <span className="text-content-muted">
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
      {data.evaluations.length > 20 && (
        <p className="mt-2 text-[10px] text-content-muted">
          ほか {data.evaluations.length - 20} 件（折りたたみ時は非表示）
        </p>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-content-muted">
        TP到達=100% / 方向のみ=80% / SL・逆転=0%。週間・月間・年間到達率はエントリー帯への到達率です。
      </p>
    </CollapsibleSection>
  );
}
