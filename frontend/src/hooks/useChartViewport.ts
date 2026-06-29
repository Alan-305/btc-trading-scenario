import { useCallback, useEffect, useRef, useState } from "react";
import type { YDomain } from "../lib/chart-viewport";
import {
  clampScrollX,
  contentWidthFor,
  dragYZoomFactor,
  panYDomain,
  priceAtPlotY,
  wheelZoomFactor,
  zoomXAtCursor,
  zoomYAtAnchor,
} from "../lib/chart-viewport";

export interface ChartViewport {
  pointWidth: number;
  scrollX: number;
  yDomain: YDomain;
  contentWidth: number;
  isAdjusted: boolean;
  reset: () => void;
  plotProps: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
    style: React.CSSProperties;
  };
  yScaleProps: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  };
  containerRef: React.RefObject<HTMLDivElement>;
  viewportWidth: number;
}

interface UseChartViewportOptions {
  pointCount: number;
  basePointWidth: number;
  baseYDomain: YDomain;
  plotHeight: number;
  plotLeftMargin?: number;
  /** Height of price pane only (excludes indicator row); Y-wheel zoom applies here. */
  pricePlotHeight?: number;
}

type DragMode = "pan" | "y-zoom" | "y-pan";

export function useChartViewport({
  pointCount,
  basePointWidth,
  baseYDomain,
  plotHeight,
  plotLeftMargin = 0,
  pricePlotHeight: pricePlotHeightOpt,
}: UseChartViewportOptions): ChartViewport {
  const pricePlotHeight = pricePlotHeightOpt ?? plotHeight;
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(640);
  const [pointWidth, setPointWidth] = useState(basePointWidth);
  const [scrollX, setScrollX] = useState(0);
  const [yOverride, setYOverride] = useState<YDomain | null>(null);

  const baseYRef = useRef(baseYDomain);
  baseYRef.current = baseYDomain;
  const basePwRef = useRef(basePointWidth);
  basePwRef.current = basePointWidth;

  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startScrollX: number;
    startYDomain: YDomain;
    pointerId: number;
  } | null>(null);

  const yDomain = yOverride ?? baseYDomain;
  const contentWidth = contentWidthFor(pointCount, pointWidth);

  const scrollXRef = useRef(scrollX);
  scrollXRef.current = scrollX;
  const pointWidthRef = useRef(pointWidth);
  pointWidthRef.current = pointWidth;
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setViewportWidth(Math.floor(w));
    });
    ro.observe(el);
    setViewportWidth(Math.floor(el.clientWidth) || 640);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setPointWidth(basePointWidth);
    setScrollX(0);
    setYOverride(null);
  }, [pointCount, basePointWidth, baseYDomain[0], baseYDomain[1]]);

  useEffect(() => {
    setScrollX((prev) => clampScrollX(prev, contentWidth, viewportWidth));
  }, [contentWidth, viewportWidth]);

  const reset = useCallback(() => {
    setPointWidth(basePwRef.current);
    setScrollX(0);
    setYOverride(null);
  }, []);

  const isAdjusted =
    Math.abs(pointWidth - basePwRef.current) > 0.5 ||
    scrollX > 1 ||
    yOverride != null;

  const endDrag = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const onPlotPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = {
      mode: "pan",
      startX: e.clientX,
      startY: e.clientY,
      startScrollX: scrollX,
      startYDomain: yDomain,
      pointerId: e.pointerId,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [scrollX, yDomain]);

  const onPlotPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId || drag.mode !== "pan") return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const nextScroll = clampScrollX(
        drag.startScrollX - dx,
        contentWidthFor(pointCount, pointWidth),
        viewportWidth,
      );
      setScrollX(nextScroll);
      const span = drag.startYDomain[1] - drag.startYDomain[0];
      const priceDelta = (dy / Math.max(pricePlotHeight, 1)) * span;
      setYOverride(panYDomain(drag.startYDomain, priceDelta));
    },
    [pointCount, pointWidth, pricePlotHeight, viewportWidth],
  );

  const onYScalePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      dragRef.current = {
        mode: e.shiftKey ? "y-pan" : "y-zoom",
        startX: e.clientX,
        startY: e.clientY,
        startScrollX: scrollX,
        startYDomain: yDomain,
        pointerId: e.pointerId,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [scrollX, yDomain],
  );

  const onYScalePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      if (drag.mode === "y-pan") {
        const dy = e.clientY - drag.startY;
        const span = drag.startYDomain[1] - drag.startYDomain[0];
        setYOverride(panYDomain(drag.startYDomain, (-dy / pricePlotHeight) * span));
        return;
      }
      if (drag.mode === "y-zoom") {
        const dy = e.clientY - drag.startY;
        const factor = dragYZoomFactor(dy, pricePlotHeight);
        const anchor = (drag.startYDomain[0] + drag.startYDomain[1]) / 2;
        setYOverride(zoomYAtAnchor(drag.startYDomain, factor, anchor));
      }
    },
    [pricePlotHeight],
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    let lastGestureScale = 1;

    const plotLeft = plotLeftMargin;

    const onWheel = (e: WheelEvent) => {
      const rect = root.getBoundingClientRect();
      const localX = e.clientX - rect.left - plotLeft;
      const localY = e.clientY - rect.top;
      if (localX < 0 || localY < 0) return;

      const zoomY = (e.shiftKey || e.altKey) && localY <= pricePlotHeight;
      const panX = Math.abs(e.deltaX) > Math.abs(e.deltaY) && !zoomY;

      if (e.ctrlKey && !zoomY) {
        e.preventDefault();
        const factor = wheelZoomFactor(e.deltaY, { pinch: true });
        const pw = pointWidthRef.current;
        const next = zoomXAtCursor({
          scrollX: scrollXRef.current,
          pointWidth: pw,
          cursorX: localX,
          factor,
          pointCount,
          viewportWidth,
        });
        setScrollX(next.scrollX);
        setPointWidth(next.pointWidth);
        return;
      }

      if (panX) {
        e.preventDefault();
        setScrollX((sx) =>
          clampScrollX(
            sx + e.deltaX,
            contentWidthFor(pointCount, pointWidthRef.current),
            viewportWidth,
          ),
        );
        return;
      }

      e.preventDefault();
      const factor = wheelZoomFactor(e.deltaY);

      if (zoomY) {
        setYOverride((prev) => {
          const current = prev ?? baseYRef.current;
          const anchor = priceAtPlotY(localY, pricePlotHeight, current);
          return zoomYAtAnchor(current, factor, anchor);
        });
        return;
      }

      const pw = pointWidthRef.current;
      const next = zoomXAtCursor({
        scrollX: scrollXRef.current,
        pointWidth: pw,
        cursorX: localX,
        factor,
        pointCount,
        viewportWidth,
      });
      setScrollX(next.scrollX);
      setPointWidth(next.pointWidth);
    };

    const onGestureStart = (e: Event) => {
      e.preventDefault();
      lastGestureScale = (e as unknown as { scale: number }).scale;
    };

    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as unknown as { scale: number };
      const ratio = ge.scale / lastGestureScale;
      lastGestureScale = ge.scale;
      if (Math.abs(ratio - 1) < 0.001) return;
      const rect = root.getBoundingClientRect();
      const localX = rect.width / 2 - plotLeft;
      setPointWidth((pw) => {
        const next = zoomXAtCursor({
          scrollX: scrollXRef.current,
          pointWidth: pw,
          cursorX: Math.max(0, localX),
          factor: ratio,
          pointCount,
          viewportWidth,
        });
        setScrollX(next.scrollX);
        return next.pointWidth;
      });
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("gesturestart", onGestureStart);
    root.addEventListener("gesturechange", onGestureChange);

    return () => {
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("gesturestart", onGestureStart);
      root.removeEventListener("gesturechange", onGestureChange);
    };
  }, [plotHeight, pricePlotHeight, plotLeftMargin, pointCount, viewportWidth]);

  const plotProps = {
    onPointerDown: onPlotPointerDown,
    onPointerMove: onPlotPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    style: {
      touchAction: "none" as const,
      cursor: isDragging ? "grabbing" : "grab",
    },
  };

  const yScaleProps = {
    onPointerDown: onYScalePointerDown,
    onPointerMove: onYScalePointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  return {
    pointWidth,
    scrollX,
    yDomain,
    contentWidth,
    isAdjusted,
    reset,
    plotProps,
    yScaleProps,
    containerRef,
    viewportWidth,
  };
}
