import type { MtfAnalysis } from "../../types/scenario";
import { trendBadgeClass, trendLabelJa } from "../../lib/mtf-entry-gate";

interface MtfSummaryPanelProps {
  mtf: MtfAnalysis;
}

export function MtfSummaryPanel({ mtf }: MtfSummaryPanelProps) {
  if (!mtf.layers.length) return null;

  return (
    <section
      className="mt-4 rounded-lg border border-surface-border/80 bg-surface-elevated/40 p-4"
      aria-label="マルチタイムフレーム分析"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-japanese text-sm font-medium text-slate-200">MTF分析（週足→日足→4H→1H）</h3>
        <p className="font-japanese text-[11px] text-content-muted">上位足で方向・下位足でタイミング</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {mtf.layers.map((layer) => (
          <div
            key={layer.interval}
            className="rounded-lg border border-surface-border/60 bg-surface-card/60 px-3 py-2.5"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-japanese text-xs font-medium text-slate-200">{layer.label_ja}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-japanese text-[10px] font-medium ${trendBadgeClass(layer.trend)}`}
              >
                {trendLabelJa(layer.trend)}
              </span>
            </div>
            <p className="font-japanese text-[11px] leading-relaxed text-content-muted">{layer.summary_ja}</p>
          </div>
        ))}
      </div>

      {mtf.summary_ja ? (
        <p className="mt-3 font-japanese text-xs leading-relaxed text-content-muted">{mtf.summary_ja}</p>
      ) : null}
    </section>
  );
}
