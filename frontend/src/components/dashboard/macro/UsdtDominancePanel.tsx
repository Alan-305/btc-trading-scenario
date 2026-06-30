import type { UsdtDominanceSnapshot } from "../../../types/scenario";
import { EXTERNAL_LINKS } from "../../../lib/external-links";
import { DataPanelMeta } from "../../ui/DataPanelMeta";
import { MacroSignalBadge, MacroSummaryText } from "./MacroCommentary";
import { UsdtDominanceChart } from "./UsdtDominanceChart";

interface UsdtDominancePanelProps {
  data: UsdtDominanceSnapshot | null;
}

export function UsdtDominancePanel({ data }: UsdtDominancePanelProps) {
  if (!data) {
    return (
      <article className="rounded-xl border border-surface-border bg-surface-card p-5">
        <DataPanelMeta
          title="USDTドミナンス"
          sourceHref={EXTERNAL_LINKS.coingecko}
          sourceLabel="CoinGecko"
        />
        <p className="mt-3 text-sm text-content-muted">データを取得できませんでした。</p>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-surface-border bg-surface-card p-5">
      <DataPanelMeta
        title="USDTドミナンス"
        subtitle="上昇=リスクオフ（BTC逆風）・低下=リスクオン（BTC追い風）"
        sourceHref={EXTERNAL_LINKS.usdtDominance}
        sourceLabel="TradingView"
        updatedAt={data.timestamp}
        headerActions={
          <MacroSignalBadge signalJa={data.signal_ja ?? "様子見"} stance={data.stance} />
        }
      />
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
