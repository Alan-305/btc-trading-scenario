import type { ReactNode } from "react";
import type { YDomain } from "../../lib/chart-viewport";
import { useChartViewport } from "../../hooks/useChartViewport";

export const Y_SCALE_WIDTH = 44;

interface ChartViewportFrameProps {
  pointCount: number;
  basePointWidth: number;
  baseYDomain: YDomain;
  plotHeight: number;
  plotLeftMargin?: number;
  bottomHeight?: number;
  bottom?: ReactNode | ((contentWidth: number) => ReactNode);
  hint?: string;
  children: (ctx: {
    contentWidth: number;
    yDomain: YDomain;
    plotHeight: number;
    plotLeftMargin: number;
  }) => ReactNode;
}

export function ChartViewportFrame({
  pointCount,
  basePointWidth,
  baseYDomain,
  plotHeight,
  plotLeftMargin = 56,
  bottomHeight = 0,
  bottom,
  hint,
  children,
}: ChartViewportFrameProps) {
  const totalLeftHeight = plotHeight + bottomHeight;

  const vp = useChartViewport({
    pointCount,
    basePointWidth,
    baseYDomain,
    plotHeight: totalLeftHeight,
    pricePlotHeight: plotHeight,
    plotLeftMargin,
  });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-content-muted">
          {hint ??
            "ドラッグ＝移動｜ホイール＝時間軸ズーム｜Shift+ホイール＝価格ズーム｜右端↕＝価格幅"}
        </p>
        {vp.isAdjusted ? (
          <button
            type="button"
            onClick={vp.reset}
            className="min-h-[32px] rounded-md border border-surface-border px-2.5 py-1 text-[10px] text-content-secondary transition hover:bg-surface-hover"
          >
            表示リセット
          </button>
        ) : null}
      </div>

      <div
        ref={vp.containerRef}
        className="overflow-hidden rounded-lg border border-surface-border/40 bg-surface/30 select-none"
      >
        <div className="flex" style={{ height: totalLeftHeight }}>
          <div
            className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
            style={{
              width: vp.viewportWidth - Y_SCALE_WIDTH,
              touchAction: vp.plotProps.style.touchAction,
              cursor: vp.plotProps.style.cursor,
            }}
            onPointerDown={vp.plotProps.onPointerDown}
            onPointerMove={vp.plotProps.onPointerMove}
            onPointerUp={vp.plotProps.onPointerUp}
            onPointerCancel={vp.plotProps.onPointerCancel}
          >
            <div
              className="relative shrink-0 overflow-hidden"
              style={{ height: plotHeight }}
            >
              <div
                className="will-change-transform"
                style={{
                  width: vp.contentWidth,
                  transform: `translate3d(${-vp.scrollX}px, 0, 0)`,
                }}
              >
                {children({
                  contentWidth: vp.contentWidth,
                  yDomain: vp.yDomain,
                  plotHeight,
                  plotLeftMargin,
                })}
              </div>
            </div>

            {bottom ? (
              <div
                className="relative shrink-0 overflow-hidden border-t border-surface-border/40"
                style={{ height: bottomHeight }}
              >
                <div
                  className="will-change-transform"
                  style={{
                    width: vp.contentWidth,
                    transform: `translate3d(${-vp.scrollX}px, 0, 0)`,
                  }}
                >
                  {typeof bottom === "function" ? bottom(vp.contentWidth) : bottom}
                </div>
              </div>
            ) : null}
          </div>

          <div
            role="slider"
            aria-label="価格軸の拡大縮小"
            className="flex shrink-0 cursor-ns-resize flex-col items-center justify-center border-l border-surface-border/50 bg-surface/60 text-[9px] leading-tight text-content-muted"
            style={{ width: Y_SCALE_WIDTH, height: totalLeftHeight }}
            {...vp.yScaleProps}
            title="ドラッグで価格幅｜Shift+ドラッグで価格移動"
          >
            <span className="font-japanese text-[9px]" style={{ writingMode: "vertical-rl" }}>
              価格
            </span>
            <span className="mt-1">↕</span>
          </div>
        </div>
      </div>
    </div>
  );
}
