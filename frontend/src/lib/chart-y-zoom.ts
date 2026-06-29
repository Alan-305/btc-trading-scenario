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

export function wheelZoomFactor(deltaY: number, options?: { pinch?: boolean }): number {
  if (options?.pinch) {
    const step = Math.min(0.18, Math.abs(deltaY) * 0.012);
    return deltaY > 0 ? 1 - step : 1 + step;
  }
  const step = Math.min(0.2, Math.max(0.04, Math.abs(deltaY) / 80));
  return deltaY > 0 ? 1 - step : 1 + step;
}

/** Apply multiplicative zoom factor to domain (factor > 1 zooms in). */
export function applyZoomFactor(domain: YDomain, factor: number, anchor: number): YDomain {
  if (Math.abs(factor - 1) < 0.001) return domain;
  return zoomYDomain(domain, factor, anchor);
}

/** Drag up on price scale = zoom in (TradingView-like). */
export function dragZoomFactor(dyPx: number, chartHeight: number): number {
  const normalized = dyPx / Math.max(chartHeight, 120);
  return 1 + normalized * 2.2;
}
