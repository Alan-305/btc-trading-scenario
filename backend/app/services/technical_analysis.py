from __future__ import annotations

import numpy as np

from app.schemas.candles import (
    BollingerValues,
    Candle,
    CandleInterval,
    MacdValues,
    OverlaySeriesPoint,
    TechnicalAnalysisResponse,
)


def _ema(values: np.ndarray, period: int) -> np.ndarray:
    if len(values) < period:
        return np.array([])
    alpha = 2.0 / (period + 1)
    result = np.empty(len(values))
    result[0] = values[0]
    for i in range(1, len(values)):
        result[i] = alpha * values[i] + (1 - alpha) * result[i - 1]
    return result


def _rsi(closes: np.ndarray, period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = np.mean(gains[-period:])
    avg_loss = np.mean(losses[-period:])
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return float(100 - (100 / (1 + rs)))


def _macd(closes: np.ndarray) -> MacdValues | None:
    if len(closes) < 35:
        return None
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    macd_line = ema12 - ema26
    signal = _ema(macd_line, 9)
    if len(signal) == 0:
        return None
    return MacdValues(
        macd=round(float(macd_line[-1]), 2),
        signal=round(float(signal[-1]), 2),
        histogram=round(float(macd_line[-1] - signal[-1]), 2),
    )


def _bollinger_series(
    closes: np.ndarray, period: int = 20, std_mult: float = 2.0
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    n = len(closes)
    upper = np.full(n, np.nan)
    middle = np.full(n, np.nan)
    lower = np.full(n, np.nan)
    for i in range(period - 1, n):
        window = closes[i - period + 1 : i + 1]
        mid = float(np.mean(window))
        std = float(np.std(window))
        middle[i] = mid
        upper[i] = mid + std_mult * std
        lower[i] = mid - std_mult * std
    return upper, middle, lower


def _swing_levels(candles: list[Candle], lookback: int = 20) -> tuple[float | None, float | None]:
    if len(candles) < lookback:
        return None, None
    recent = candles[-lookback:]
    return min(c.low for c in recent), max(c.high for c in recent)


def _build_overlay_series(candles: list[Candle]) -> list[OverlaySeriesPoint]:
    if not candles:
        return []
    closes = np.array([c.close for c in candles], dtype=float)
    ema200 = _ema(closes, 200)
    bb_upper, bb_middle, bb_lower = _bollinger_series(closes)

    series: list[OverlaySeriesPoint] = []
    for i, c in enumerate(candles):
        series.append(
            OverlaySeriesPoint(
                ts=c.ts,
                ema_200=round(float(ema200[i]), 2) if len(ema200) > i and i >= 199 else None,
                bb_upper=round(float(bb_upper[i]), 2) if not np.isnan(bb_upper[i]) else None,
                bb_middle=round(float(bb_middle[i]), 2) if not np.isnan(bb_middle[i]) else None,
                bb_lower=round(float(bb_lower[i]), 2) if not np.isnan(bb_lower[i]) else None,
            )
        )
    return series


class TechnicalAnalysisService:
    def analyze(
        self,
        candles: list[Candle],
        interval: CandleInterval = "4h",
        symbol: str = "BTCUSDT",
    ) -> TechnicalAnalysisResponse:
        if not candles:
            return TechnicalAnalysisResponse(
                symbol=symbol,
                interval=interval,
                summary_ja="ローソク足データが不足しています。",
            )

        closes = np.array([c.close for c in candles], dtype=float)
        rsi = _rsi(closes)
        ema20 = float(_ema(closes, 20)[-1]) if len(closes) >= 20 else None
        ema50 = float(_ema(closes, 50)[-1]) if len(closes) >= 50 else None
        ema200_arr = _ema(closes, 200)
        ema200 = float(ema200_arr[-1]) if len(ema200_arr) >= 200 else None
        macd = _macd(closes)
        bb_upper, bb_middle, bb_lower = _bollinger_series(closes)
        bollinger: BollingerValues | None = None
        if not np.isnan(bb_upper[-1]):
            bollinger = BollingerValues(
                upper=round(float(bb_upper[-1]), 2),
                middle=round(float(bb_middle[-1]), 2),
                lower=round(float(bb_lower[-1]), 2),
            )
        support, resistance = _swing_levels(candles)
        price = float(closes[-1])
        overlay_series = _build_overlay_series(candles)

        bullish = 0
        bearish = 0
        if rsi is not None:
            if rsi < 35:
                bullish += 1
            elif rsi > 65:
                bearish += 1
        if ema20 is not None and ema50 is not None:
            if ema20 > ema50:
                bullish += 1
            elif ema20 < ema50:
                bearish += 1
        if macd is not None:
            if macd.histogram > 0:
                bullish += 1
            elif macd.histogram < 0:
                bearish += 1
        if ema200 is not None:
            if price > ema200:
                bullish += 1
            elif price < ema200:
                bearish += 1
        if bollinger is not None:
            if price <= bollinger.lower:
                bullish += 1
            elif price >= bollinger.upper:
                bearish += 1

        if bullish > bearish:
            trend = "bullish"
        elif bearish > bullish:
            trend = "bearish"
        else:
            trend = "neutral"

        parts: list[str] = []
        if rsi is not None:
            rsi_label = "買われすぎ" if rsi > 70 else "売られすぎ" if rsi < 30 else "中立"
            parts.append(f"RSI {rsi:.0f}（{rsi_label}）")
        if ema20 is not None and ema50 is not None:
            cross = "ゴールデンクロス寄り" if ema20 > ema50 else "デッドクロス寄り"
            parts.append(f"EMA20/50 {cross}")
        if ema200 is not None:
            ema200_label = "200EMA上" if price > ema200 else "200EMA下"
            parts.append(ema200_label)
        if bollinger is not None:
            if price >= bollinger.upper:
                parts.append("BB上限タッチ")
            elif price <= bollinger.lower:
                parts.append("BB下限タッチ")
            else:
                parts.append("BB内")
        if macd is not None:
            macd_label = "上昇モメンタム" if macd.histogram > 0 else "下降モメンタム"
            parts.append(f"MACD {macd_label}")
        if support and resistance:
            parts.append(f"サポ ${support:,.0f} / レジ ${resistance:,.0f}")

        summary = "・".join(parts) if parts else f"現在価格 ${price:,.0f} 付近を分析中です。"

        return TechnicalAnalysisResponse(
            symbol=symbol,
            interval=interval,
            rsi_14=round(rsi, 1) if rsi is not None else None,
            ema_20=round(ema20, 2) if ema20 is not None else None,
            ema_50=round(ema50, 2) if ema50 is not None else None,
            ema_200=round(ema200, 2) if ema200 is not None else None,
            bollinger=bollinger,
            macd=macd,
            support=round(support, 2) if support else None,
            resistance=round(resistance, 2) if resistance else None,
            trend=trend,
            summary_ja=summary,
            overlay_series=overlay_series,
        )
