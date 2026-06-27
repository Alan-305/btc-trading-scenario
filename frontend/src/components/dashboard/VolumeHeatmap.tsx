import type { HeatmapCell } from "../../types/scenario";
import { EXTERNAL_LINKS } from "../../lib/external-links";
import { ExternalLink } from "../ui/ExternalLink";

interface VolumeHeatmapProps {
  cells: HeatmapCell[];
}

export function VolumeHeatmap({ cells }: VolumeHeatmapProps) {
  if (!cells.length) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="mb-3 text-sm font-medium text-slate-400">板厚みヒートマップ</h3>
        <p className="text-sm text-slate-500">データなし</p>
      </div>
    );
  }

  const maxDepth = Math.max(...cells.map((c) => c.bid_depth + c.ask_depth), 1);

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-400">板厚みヒートマップ</h3>
        <ExternalLink href={EXTERNAL_LINKS.whitebit}>WhiteBIT</ExternalLink>
      </div>
      <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
        {cells.slice(0, 24).map((cell, i) => {
          const intensity = (cell.bid_depth + cell.ask_depth) / maxDepth;
          const bidRatio = cell.bid_depth / (cell.bid_depth + cell.ask_depth + 0.001);
          const bg =
            bidRatio > 0.55
              ? `rgba(34, 197, 94, ${0.2 + intensity * 0.6})`
              : `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`;
          return (
            <div
              key={i}
              className="aspect-square rounded-sm"
              style={{ backgroundColor: bg }}
              title={`$${cell.price_bin.toFixed(0)}`}
            />
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">緑=買い厚み / 赤=売り厚み</p>
    </div>
  );
}
