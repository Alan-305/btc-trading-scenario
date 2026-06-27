import type { RiskZonesResponse } from "../../types/market";
import { EXTERNAL_LINKS } from "../../lib/external-links";
import { ExternalLink } from "../ui/ExternalLink";

interface RiskZonesPanelProps {
  data: RiskZonesResponse | null;
}

function ZoneRow({ zone }: { zone: NonNullable<RiskZonesResponse["long_liquidation"]> }) {
  return (
    <div className="rounded-lg border border-surface-border/60 bg-slate-800/40 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-300">{zone.label}</span>
        <span className="text-xs text-slate-500">信頼度 {(zone.confidence * 100).toFixed(0)}%</span>
      </div>
      <p className="font-english text-base text-slate-100">
        ${zone.zone_low.toLocaleString()} – ${zone.zone_high.toLocaleString()}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{zone.rationale}</p>
    </div>
  );
}

export function RiskZonesPanel({ data }: RiskZonesPanelProps) {
  if (!data) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="mb-3 text-sm font-medium text-slate-400">清算・スクイズ帯（推定）</h3>
        <p className="text-sm text-slate-500">データなし</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-400">清算・スクイズ帯（推定）</h3>
        <ExternalLink href={EXTERNAL_LINKS.binanceFutures}>Binance先物</ExternalLink>
      </div>
      <p className="mb-3 font-english text-xs text-slate-500">
        基準価格 ${data.reference_price.toLocaleString()}
      </p>
      <div className="space-y-3">
        {data.long_liquidation && <ZoneRow zone={data.long_liquidation} />}
        {data.short_squeeze && <ZoneRow zone={data.short_squeeze} />}
        {!data.long_liquidation && !data.short_squeeze && (
          <p className="text-sm text-slate-500">現在、明確な推定帯は検出されていません。</p>
        )}
      </div>
      <p className="mt-3 text-[10px] text-slate-600">{data.disclaimer}</p>
    </div>
  );
}
