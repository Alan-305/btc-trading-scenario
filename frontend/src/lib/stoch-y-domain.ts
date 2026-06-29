export interface StochPoint {
  k: number | null;
  d: number | null;
}

/** Auto-fit Y domain so %K / %D lines stay readable (matches entry chart). */
export function stochYDomain(data: StochPoint[]): [number, number] {
  const vals = data.flatMap((p) => [p.k, p.d]).filter((v): v is number => v != null);
  if (vals.length < 2) return [0, 100];

  let min = Math.min(...vals);
  let max = Math.max(...vals);
  const span = max - min || 8;
  const pad = Math.max(14, span * 0.5);
  min = Math.max(0, min - pad);
  max = Math.min(100, max + pad);

  if (max - min < 28) {
    const mid = (max + min) / 2;
    min = Math.max(0, mid - 14);
    max = Math.min(100, mid + 14);
  }

  return [Math.floor(min), Math.ceil(max)];
}
