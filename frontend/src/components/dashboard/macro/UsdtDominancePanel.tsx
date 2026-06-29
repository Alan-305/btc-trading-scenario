import type { UsdtDominanceSnapshot } from "../../../types/scenario";
import { EXTERNAL_LINKS } from "../../../lib/external-links";
import { ExternalLink } from "../../ui/ExternalLink";
import { MacroSignalBadge, MacroSummaryText } from "./MacroCommentary";
import { UsdtDominanceChart } from "./UsdtDominanceChart";

interface UsdtDominancePanelProps {
  data: UsdtDominanceSnapshot | null;
}

export function UsdtDominancePanel({ data }: UsdtDominancePanelProps) {
  if (!data) {
    return (
      <article className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h4 className="font-japanese text-sm font-medium text-slate-200">USDTドミナンス</h4>
        <p className="mt-3 text-sm text-content-muted">データを取得できませんでした。</p>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-surface-border bg-surface-card p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-japanese text-sm font-medium text-slate-200">USDTドミナンス</h4>
          <p className="mt-0.5 font-japanese text-[10px] text-content-muted">
            上昇=リスクオフ（BTC逆風）・低下=リスクオン（BTC追い風）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MacroSignalBadge signalJa={data.signal_ja ?? "様子見"} stance={data.stance} />
          <ExternalLink href={EXTERNAL_LINKS.usdtDominance} className="text-xs">
            TradingView
          </ExternalLink>
        </div>
      </header>
      <UsdtDominanceChart
        history={data.history ?? []}
        current={data.dominance_pct}
        change7d={data.change_7d_pct}
        trend={data.trend}
      />
      <MacroSummaryText summary={data.summary_ja ?? ""} />
    </article>
  );
}
