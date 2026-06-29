import { useEffect, useMemo, useRef, useState } from "react";
import type { StochSeriesPoint } from "../../types/market";
import { formatChartDate } from "../../lib/macro-chart-utils";
import { STOCH_PLOT_HEIGHT, StochasticComposedChart } from "../chart/StochasticComposedChart";

interface StochasticChartProps {
  series: StochSeriesPoint[];
  k: number | null;
  d: number | null;
  lastCross: "gc" | "dc" | null;
}

export function StochasticChart({ series, k, d, lastCross }: StochasticChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(Math.floor(w));
    });
    ro.observe(el);
    setWidth(Math.floor(el.clientWidth) || 640);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(
    () =>
      series.map((p) => ({
        label: formatChartDate(p.ts),
        k: p.k,
        d: p.d,
        cross: p.cross,
      })),
    [series],
  );

  const crossPoints = data.filter((p) => p.cross === "gc" || p.cross === "dc");
  const recentCrosses = crossPoints.slice(-4).reverse();
  const spreadNow = k != null && d != null ? k - d : null;

  if (!data.length) {
    return <p className="text-sm text-content-muted">ストキャスデータがありません</p>;
  }

  return (
    <div ref={containerRef}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="font-english text-sm text-slate-200">
            %K{" "}
            <span className="font-semibold text-cyan-300">{k?.toFixed(1) ?? "—"}</span>
            <span className="mx-2 text-content-muted">/</span>
            %D <span className="font-semibold text-orange-300">{d?.toFixed(1) ?? "—"}</span>
          </p>
          {spreadNow != null ? (
            <span
              className={`font-english text-xs ${
                spreadNow > 0 ? "text-accent-green" : spreadNow < 0 ? "text-accent-red" : "text-content-muted"
              }`}
            >
              乖離 {spreadNow >= 0 ? "+" : ""}
              {spreadNow.toFixed(1)}
            </span>
          ) : null}
        </div>
        {lastCross ? (
          <span
            className={`rounded-full px-2 py-0.5 font-japanese text-[10px] font-medium ${
              lastCross === "gc"
                ? "bg-accent-green/15 text-accent-green"
                : "bg-accent-red/15 text-accent-red"
            }`}
          >
            直近{lastCross === "gc" ? "GC" : "DC"}
          </span>
        ) : null}
      </div>

      <StochasticComposedChart data={data} width={width} height={STOCH_PLOT_HEIGHT} showXAxis />

      {recentCrosses.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {recentCrosses.map((p) => (
            <li
              key={`${p.label}-${p.cross}`}
              className={`rounded-md px-2 py-0.5 font-japanese text-[10px] ${
                p.cross === "gc"
                  ? "bg-accent-green/10 text-accent-green"
                  : "bg-accent-red/10 text-accent-red"
              }`}
            >
              {p.label} {p.cross === "gc" ? "GC" : "DC"}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 font-japanese text-[10px] text-content-muted">
        %K 水色・%D オレンジの実線。GC/DC は丸印とラベルで表示します（エントリー判断チャートと同じ）。
      </p>
    </div>
  );
}
