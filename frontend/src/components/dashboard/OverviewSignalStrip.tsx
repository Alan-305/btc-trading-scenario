import type { DashboardSection } from "../../lib/dashboard-nav";
import type { IndicatorSignal } from "../../lib/indicator-signals";
import { MACRO_STANCE_STYLE } from "./macro/MacroCommentary";

export interface SignalStripItem {
  id: string;
  label: string;
  section: DashboardSection;
  signal: IndicatorSignal;
}

interface OverviewSignalStripProps {
  items: SignalStripItem[];
  onNavigate: (section: DashboardSection) => void;
}

export function OverviewSignalStrip({ items, onNavigate }: OverviewSignalStripProps) {
  if (!items.length) return null;

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5">
      <header className="mb-4">
        <h2 className="font-japanese text-sm font-medium text-slate-300">指標サマリー</h2>
        <p className="mt-1 font-japanese text-[11px] text-content-muted">
          各指標のシグナルです。タップで詳細セクションへ移動します。
        </p>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const style = MACRO_STANCE_STYLE[item.signal.stance];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.section)}
              className="min-h-[44px] rounded-lg border border-surface-border/70 bg-surface-elevated/40 px-3 py-3 text-left transition hover:border-content-muted hover:bg-surface-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="font-japanese text-xs font-medium text-slate-300">{item.label}</span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 font-japanese text-[10px] font-medium ${style.bg} ${style.color}`}
                >
                  {item.signal.signalJa}
                </span>
              </div>
              <p className="line-clamp-2 font-japanese text-[10px] leading-relaxed text-content-muted">
                {item.signal.summaryJa}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
