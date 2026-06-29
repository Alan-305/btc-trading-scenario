export type YDomain = [number, number];

const MIN_POINT_WIDTH = 8;
const MAX_POINT_WIDTH = 120;
const MIN_Y_SPAN_RATIO = 0.0008;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** factor > 1 = zoom in (narrower range), anchored at price under cursor */
export function zoomYAtAnchor(domain: YDomain, factor: number, anchor: number): YDomain {
  const [min, max] = domain;
  const span = max - min;
  if (span <= 0) return domain;
  const f = clamp(factor, 0.06, 14);
  const nextMin = anchor - (anchor - min) / f;
  const nextMax = anchor + (max - anchor) / f;
  if (nextMax - nextMin < span * MIN_Y_SPAN_RATIO) return domain;
  return [nextMin, nextMax];
}

export function panYDomain(domain: YDomain, delta: number): YDomain {
  return [domain[0] + delta, domain[1] + delta];
}

/** Smooth exponential wheel factor (TradingView-like). */
export function wheelZoomFactor(deltaY: number, options?: { pinch?: boolean }): number {
  const sensitivity = options?.pinch ? 0.0035 : 0.0022;
  const capped = clamp(deltaY, -120, 120);
  return Math.exp(-capped * sensitivity);
}

export function dragYZoomFactor(dyPx: number, chartHeight: number): number {
  const normalized = dyPx / Math.max(chartHeight, 80);
  return 1 + normalized * 1.8;
}

export function priceAtPlotY(
  yPx: number,
  plotHeight: number,
  domain: YDomain,
): number {
  const [min, max] = domain;
  const t = clamp(yPx / Math.max(plotHeight, 1), 0, 1);
  return max - t * (max - min);
}

export function clampScrollX(scrollX: number, contentWidth: number, viewportWidth: number): number {
  const maxScroll = Math.max(0, contentWidth - viewportWidth);
  return clamp(scrollX, 0, maxScroll);
}

export function zoomXAtCursor(options: {
  scrollX: number;
  pointWidth: number;
  cursorX: number;
  factor: number;
  pointCount: number;
  viewportWidth: number;
}): { scrollX: number; pointWidth: number } {
  const { scrollX, pointWidth, cursorX, factor, pointCount, viewportWidth } = options;
  const contentX = scrollX + cursorX;
  const anchorIndex = contentX / Math.max(pointWidth, 1);

  const nextWidth = clamp(pointWidth * factor, MIN_POINT_WIDTH, MAX_POINT_WIDTH);
  const contentWidth = pointCount * nextWidth;
  const nextScroll = anchorIndex * nextWidth - cursorX;

  return {
    pointWidth: nextWidth,
    scrollX: clampScrollX(nextScroll, contentWidth, viewportWidth),
  };
}

export function contentWidthFor(pointCount: number, pointWidth: number): number {
  return Math.max(pointCount * pointWidth, 1);
}
