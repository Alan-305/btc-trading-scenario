import { EXTERNAL_LINKS } from "../../lib/external-links";
import { ExternalLink } from "../ui/ExternalLink";

interface FearGreedMeterProps {
  value: number | null;
  classification?: string;
}

export function FearGreedMeter({ value, classification }: FearGreedMeterProps) {
  const v = value ?? 50;
  const color =
    v >= 75 ? "text-accent-red" : v >= 55 ? "text-accent-amber" : v >= 45 ? "text-slate-300" : v >= 25 ? "text-accent-blue" : "text-accent-green";

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-400">Fear & Greed</h3>
        <ExternalLink href={EXTERNAL_LINKS.fearGreed}>Alternative.me</ExternalLink>
      </div>
      <div className="flex items-end gap-3">
        <span className={`font-english text-4xl font-semibold ${color}`}>{v}</span>
        <span className="mb-1 text-sm text-slate-500">{classification ?? "—"}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-green via-accent-amber to-accent-red"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
