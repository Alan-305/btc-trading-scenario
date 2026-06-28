import type { EntryZone, ExitStrategy } from "../../types/scenario";

interface TradeZonesProps {
  entry: EntryZone;
  exit: ExitStrategy;
}

const SIDE_LABEL = { long: "ロング", short: "ショート", neutral: "様子見" };

export function TradeZones({ entry, exit }: TradeZonesProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-surface-border bg-surface-card p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-300">エントリー帯</h3>
        <p className="font-english text-lg text-accent-blue">
          ${entry.zone_low.toLocaleString()} – ${entry.zone_high.toLocaleString()}
        </p>
        <p className="mt-1 text-sm text-content-secondary">{SIDE_LABEL[entry.side]}</p>
        <p className="mt-2 text-xs text-content-muted">{entry.rationale}</p>
      </div>
      <div className="rounded-lg border border-surface-border bg-surface-card p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-300">利確・損切り</h3>
        <p className="font-english text-sm text-accent-green">
          TP: {exit.take_profit.map((p) => `$${p.toLocaleString()}`).join(" / ")}
        </p>
        <p className="font-english mt-1 text-sm text-accent-red">
          SL: ${exit.stop_loss.toLocaleString()}
        </p>
        <p className="mt-2 text-xs text-content-muted">{exit.rationale}</p>
      </div>
    </div>
  );
}
