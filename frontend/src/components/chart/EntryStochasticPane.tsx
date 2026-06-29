import type { AlignedStochRow } from "../../lib/align-stoch-history";
import { STOCH_PLOT_HEIGHT, StochasticComposedChart } from "./StochasticComposedChart";

export const ENTRY_STOCH_PLOT_HEIGHT = STOCH_PLOT_HEIGHT;
export const ENTRY_STOCH_XAXIS_HEIGHT = 72;
export const ENTRY_STOCH_HEIGHT = STOCH_PLOT_HEIGHT + ENTRY_STOCH_XAXIS_HEIGHT;

interface EntryStochasticPaneProps {
  data: AlignedStochRow[];
  width: number;
  showXAxis?: boolean;
}

export function EntryStochasticPane({ data, width, showXAxis = true }: EntryStochasticPaneProps) {
  const chartRows = data.map((row) => ({
    label: row.ts,
    k: row.k,
    d: row.d,
    cross: row.cross,
  }));

  return (
    <div
      className="relative border-t border-surface-border/40 bg-surface/20"
      style={{ width, height: showXAxis ? ENTRY_STOCH_HEIGHT : STOCH_PLOT_HEIGHT + 30 }}
    >
      <StochasticComposedChart
        data={chartRows}
        width={width}
        height={STOCH_PLOT_HEIGHT}
        showXAxis={showXAxis}
        xAxisHeight={ENTRY_STOCH_XAXIS_HEIGHT}
        nowMarkerLabel="いま"
      />
    </div>
  );
}
