import type { CoinglassSnapshot } from "../../types/scenario";

interface CoinglassPanelProps {
  data: CoinglassSnapshot | null;
}

export function CoinglassPanel({ data }: CoinglassPanelProps) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h3 className="mb-3 text-sm font-medium text-slate-400">Coinglass</h3>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Open Interest</dt>
          <dd className="font-english text-slate-200">
            {data?.open_interest_usd
              ? `$${(data.open_interest_usd / 1e9).toFixed(2)}B`
              : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Funding Rate</dt>
          <dd className="font-english text-slate-200">
            {data?.funding_rate != null ? `${(data.funding_rate * 100).toFixed(4)}%` : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">L/S Ratio</dt>
          <dd className="font-english text-slate-200">
            {data?.long_short_ratio?.toFixed(2) ?? "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
