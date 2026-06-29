import { useMemo, useState } from "react";
import type { Candle, OverlayPoint } from "../../types/market";

interface CandlestickChartProps {
  candles: Candle[];
  interval?: string;
  overlays?: OverlayPoint[];
  support?: number | null;
  resistance?: number | null;
  longLiqLow?: number | null;
  longLiqHigh?: number | null;
  shortSqLow?: number | null;
  shortSqHigh?: number | null;
}

const W = 800;
const PRICE_TOP = 16;
const PRICE_H = 260;
const VOL_GAP = 10;
const VOL_H = 56;
const DATE_TOP = PRICE_TOP + PRICE_H + VOL_GAP + VOL_H + 6;
const PAD = { left: 8, right: 56 };
const H = DATE_TOP + 22;

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric" });
}

function formatVolume(vol: number): string {
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
  return vol.toFixed(0);
}

function buildLinePath(
  points: { x: number; y: number }[],
): string {
  if (!points.length) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function buildBandPath(
  upper: { x: number; y: number }[],
  lower: { x: number; y: number }[],
): string {
  if (!upper.length || !lower.length) return "";
  const forward = upper.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const backward = [...lower]
    .reverse()
    .map((p) => `L ${p.x} ${p.y}`)
    .join(" ");
  return `${forward} ${backward} Z`;
}

export function CandlestickChart({
  candles,
  interval = "4h",
  overlays = [],
  support,
  resistance,
  longLiqLow,
  longLiqHigh,
  shortSqLow,
  shortSqHigh,
}: CandlestickChartProps) {
  const [hovered, setHovered] = useState<Candle | null>(null);

  const intervalTag = interval === "1d" ? "1D" : interval.toUpperCase();
  const slice = useMemo(() => candles.slice(-60), [candles]);
  const overlayByTs = useMemo(
    () => new Map(overlays.map((o) => [o.ts, o])),
    [overlays],
  );

  if (!candles.length) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-content-muted">
        ローソク足データなし
      </div>
    );
  }

  const chartW = W - PAD.left - PAD.right;
  const slot = chartW / slice.length;
  const bodyW = Math.max(3, slot * 0.55);

  const overlayPrices: number[] = [];
  slice.forEach((c) => {
    const o = overlayByTs.get(c.ts);
    if (!o) return;
    if (o.ema_200 != null) overlayPrices.push(o.ema_200);
    if (o.bb_upper != null) overlayPrices.push(o.bb_upper);
    if (o.bb_lower != null) overlayPrices.push(o.bb_lower);
  });

  const lows = slice.map((c) => c.low);
  const highs = slice.map((c) => c.high);
  const zoneLows = [support, longLiqLow, shortSqLow].filter((v): v is number => v != null);
  const zoneHighs = [resistance, longLiqHigh, shortSqHigh].filter((v): v is number => v != null);
  const minP = Math.min(...lows, ...zoneLows, ...overlayPrices) * 0.998;
  const maxP = Math.max(...highs, ...zoneHighs, ...overlayPrices) * 1.002;
  const range = maxP - minP || 1;
  const maxVol = Math.max(...slice.map((c) => c.volume), 1);

  const priceY = (price: number) => PRICE_TOP + PRICE_H - ((price - minP) / range) * PRICE_H;
  const volY = (vol: number) => PRICE_TOP + PRICE_H + VOL_GAP + VOL_H - (vol / maxVol) * VOL_H;
  const yTicks = [minP, minP + range * 0.5, maxP];

  const dateLabelIndices = slice
    .map((c, i) => ({ i, day: formatDateShort(c.ts) }))
    .filter((item, idx, arr) => idx === 0 || item.day !== arr[idx - 1].day)
    .filter((_, idx) => idx % 2 === 0 || slice.length <= 20);

  const emaPoints: { x: number; y: number }[] = [];
  const bbUpperPoints: { x: number; y: number }[] = [];
  const bbMiddlePoints: { x: number; y: number }[] = [];
  const bbLowerPoints: { x: number; y: number }[] = [];

  slice.forEach((c, i) => {
    const cx = PAD.left + i * slot + slot / 2;
    const o = overlayByTs.get(c.ts);
    if (!o) return;
    if (o.ema_200 != null) emaPoints.push({ x: cx, y: priceY(o.ema_200) });
    if (o.bb_upper != null) bbUpperPoints.push({ x: cx, y: priceY(o.bb_upper) });
    if (o.bb_middle != null) bbMiddlePoints.push({ x: cx, y: priceY(o.bb_middle) });
    if (o.bb_lower != null) bbLowerPoints.push({ x: cx, y: priceY(o.bb_lower) });
  });

  const hoveredOverlay = hovered ? overlayByTs.get(hovered.ts) : null;

  return (
    <div className="w-full">
      {hovered && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-surface-border bg-surface-hover/80 px-3 py-2 text-xs">
          <span className="text-slate-300">{formatDate(hovered.ts)}</span>
          <span className="font-english text-content-secondary">
            O ${hovered.open.toLocaleString()} / H ${hovered.high.toLocaleString()} / L{" "}
            {hovered.low.toLocaleString()} / C ${hovered.close.toLocaleString()}
          </span>
          <span className="font-english text-content-secondary">Vol {formatVolume(hovered.volume)}</span>
          {hoveredOverlay?.ema_200 != null && (
            <span className="font-english text-violet-300">
              EMA200 ${hoveredOverlay.ema_200.toLocaleString()}
            </span>
          )}
          {hoveredOverlay?.bb_upper != null && hoveredOverlay.bb_lower != null && (
            <span className="font-english text-content-secondary">
              BB ${hoveredOverlay.bb_lower.toLocaleString()}–${hoveredOverlay.bb_upper.toLocaleString()}
            </span>
          )}
        </div>
      )}

      <div className="h-80 w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          className="block"
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={priceY(tick)}
                x2={W - PAD.right}
                y2={priceY(tick)}
                stroke="#2a2a2a"
                strokeDasharray="3 3"
              />
              <text
                x={W - PAD.right + 4}
                y={priceY(tick) + 4}
                fill="#94a3b8"
                fontSize="10"
                className="font-english"
              >
                ${(tick / 1000).toFixed(1)}k
              </text>
            </g>
          ))}

          <line
            x1={PAD.left}
            y1={PRICE_TOP + PRICE_H + VOL_GAP / 2}
            x2={W - PAD.right}
            y2={PRICE_TOP + PRICE_H + VOL_GAP / 2}
            stroke="#475569"
            strokeWidth={1}
          />

          {longLiqLow != null && longLiqHigh != null && (
            <rect
              x={PAD.left}
              y={priceY(longLiqHigh)}
              width={chartW}
              height={Math.max(1, priceY(longLiqLow) - priceY(longLiqHigh))}
              fill="rgba(239,68,68,0.12)"
            />
          )}
          {shortSqLow != null && shortSqHigh != null && (
            <rect
              x={PAD.left}
              y={priceY(shortSqHigh)}
              width={chartW}
              height={Math.max(1, priceY(shortSqLow) - priceY(shortSqHigh))}
              fill="rgba(34,197,94,0.12)"
            />
          )}

          {bbUpperPoints.length > 1 && bbLowerPoints.length > 1 && (
            <path
              d={buildBandPath(bbUpperPoints, bbLowerPoints)}
              fill="rgba(148,163,184,0.12)"
              stroke="none"
            />
          )}
          {bbUpperPoints.length > 1 && (
            <path
              d={buildLinePath(bbUpperPoints)}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="3 2"
              opacity={0.7}
            />
          )}
          {bbLowerPoints.length > 1 && (
            <path
              d={buildLinePath(bbLowerPoints)}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="3 2"
              opacity={0.7}
            />
          )}
          {bbMiddlePoints.length > 1 && (
            <path
              d={buildLinePath(bbMiddlePoints)}
              fill="none"
              stroke="#64748b"
              strokeWidth={1}
              opacity={0.5}
            />
          )}
          {emaPoints.length > 1 && (
            <path
              d={buildLinePath(emaPoints)}
              fill="none"
              stroke="#a78bfa"
              strokeWidth={1.5}
            />
          )}

          {support != null && (
            <line
              x1={PAD.left}
              y1={priceY(support)}
              x2={W - PAD.right}
              y2={priceY(support)}
              stroke="#3b82f6"
              strokeDasharray="4 4"
              opacity={0.7}
            />
          )}
          {resistance != null && (
            <line
              x1={PAD.left}
              y1={priceY(resistance)}
              x2={W - PAD.right}
              y2={priceY(resistance)}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              opacity={0.7}
            />
          )}

          {slice.map((c, i) => {
            const cx = PAD.left + i * slot + slot / 2;
            const up = c.close >= c.open;
            const color = up ? "#22c55e" : "#ef4444";
            const bodyTop = priceY(Math.max(c.open, c.close));
            const bodyBot = priceY(Math.min(c.open, c.close));
            const bodyH = Math.max(1, bodyBot - bodyTop);
            const volTop = volY(c.volume);
            const volBarH = PRICE_TOP + PRICE_H + VOL_GAP + VOL_H - volTop;
            const isHovered = hovered?.ts === c.ts;

            return (
              <g
                key={c.ts}
                onMouseEnter={() => setHovered(c)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "crosshair" }}
              >
                <rect
                  x={PAD.left + i * slot}
                  y={PRICE_TOP}
                  width={slot}
                  height={PRICE_H + VOL_GAP + VOL_H}
                  fill="transparent"
                />
                <line x1={cx} y1={priceY(c.high)} x2={cx} y2={priceY(c.low)} stroke={color} strokeWidth={1} />
                <rect
                  x={cx - bodyW / 2}
                  y={bodyTop}
                  width={bodyW}
                  height={bodyH}
                  fill={color}
                  opacity={isHovered ? 1 : 0.9}
                />
                <rect
                  x={cx - bodyW / 2}
                  y={volTop}
                  width={bodyW}
                  height={Math.max(1, volBarH)}
                  fill={color}
                  opacity={isHovered ? 0.85 : 0.55}
                />
              </g>
            );
          })}

          <text
            x={PAD.left}
            y={PRICE_TOP + PRICE_H + VOL_GAP + VOL_H + 12}
            fill="#64748b"
            fontSize="9"
          >
            出来高
          </text>

          {dateLabelIndices.map(({ i, day }) => {
            const cx = PAD.left + i * slot + slot / 2;
            return (
              <text
                key={`${day}-${i}`}
                x={cx}
                y={DATE_TOP + 12}
                fill="#94a3b8"
                fontSize="9"
                textAnchor="middle"
                className="font-english"
              >
                {day}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-content-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-violet-400" />
          EMA200（{intervalTag}）
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-4 rounded-sm bg-slate-400/20 border border-slate-500/40" />
          ボリンジャー(20,2σ)
        </span>
        <span>赤帯=Long清算 / 緑帯=スクイズ（リキッド帯・推定）</span>
      </div>
    </div>
  );
}
