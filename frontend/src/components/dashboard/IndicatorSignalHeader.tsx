import type { IndicatorSignal } from "../../lib/indicator-signals";
import { MACRO_STANCE_STYLE } from "./macro/MacroCommentary";
import { MacroSignalBadge } from "./macro/MacroCommentary";

interface IndicatorSignalHeaderProps {
  signal: IndicatorSignal;
  compact?: boolean;
}

export function IndicatorSignalHeader({ signal, compact = false }: IndicatorSignalHeaderProps) {
  const style = MACRO_STANCE_STYLE[signal.stance];
  if (compact) {
    return (
      <p className={`font-japanese text-xs leading-relaxed ${style.color}`}>
        <span className="font-medium">{signal.signalJa}:</span> {signal.summaryJa}
      </p>
    );
  }
  return (
    <div className="mb-3 space-y-2 rounded-lg border border-surface-border/50 bg-surface/30 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-japanese text-xs font-medium text-slate-400">総合</span>
        <MacroSignalBadge signalJa={signal.signalJa} stance={signal.stance} />
      </div>
      <p className="font-japanese text-xs leading-relaxed text-slate-500">{signal.summaryJa}</p>
    </div>
  );
}
