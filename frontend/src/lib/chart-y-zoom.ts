export type YDomain = [number, number];

/** factor > 1 = zoom in (narrower range), factor < 1 = zoom out */
export function zoomYDomain(domain: YDomain, factor: number, anchor: number): YDomain {
  const [min, max] = domain;
  const f = Math.min(12, Math.max(0.08, factor));
  const nextMin = anchor - (anchor - min) / f;
  const nextMax = anchor + (max - anchor) / f;
  if (nextMax - nextMin < 1) return domain;
  return [nextMin, nextMax];
}

export function panYDomain(domain: YDomain, delta: number): YDomain {
  return [domain[0] + delta, domain[1] + delta];
}

export function wheelZoomFactor(deltaY: number): number {
  return deltaY > 0 ? 0.92 : 1.08;
}

/** Drag up on price scale = zoom in (TradingView-like). */
export function dragZoomFactor(dyPx: number, chartHeight: number): number {
  const normalized = dyPx / Math.max(chartHeight, 120);
  return 1 + normalized * 2.2;
}
