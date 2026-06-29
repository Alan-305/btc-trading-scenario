from __future__ import annotations

import numpy as np

from app.schemas.candles import (
    BollingerValues,
    Candle,
    CandleInterval,
    MacdValues,
    OverlaySeriesPoint,
    StochSeriesPoint,
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


def _atr(candles: list[Candle], period: int = 14) -> float | None:
    if len(candles) < period + 1:
        return None
    trs: list[float] = []
    for i in range(1, len(candles)):
        high = candles[i].high
        low = candles[i].low
        prev_close = candles[i - 1].close
        trs.append(max(high - low, abs(high - prev_close), abs(low - prev_close)))
    if len(trs) < period:
        return None
    atr = sum(trs[:period]) / period
    for tr in trs[period:]:
        atr = (atr * (period - 1) + tr) / period
    return round(float(atr), 2)


def _sma(values: list[float], period: int) -> list[float]:
    if len(values) < period:
        return []
    out: list[float] = []
    for i in range(period - 1, len(values)):
        window = values[i - period + 1 : i + 1]
        out.append(sum(window) / period)
    return out


def _stochastic(
    candles: list[Candle],
    k_period: int = 14,
    k_smooth: int = 3,
    d_period: int = 3,
) -> tuple[list[float], list[float], list[datetime]]:
    """Stoch(14,3,3): %K smoothed, %D = SMA of %K."""
    if len(candles) < k_period:
        return [], [], []

    raw_k: list[float] = []
    ts_list: list[datetime] = []
    for i in range(k_period - 1, len(candles)):
        window = candles[i - k_period + 1 : i + 1]
        lows = [c.low for c in window]
        highs = [c.high for c in window]
        close = candles[i].close
        lo, hi = min(lows), max(highs)
        if hi <= lo:
            raw_k.append(50.0)
        else:
            raw_k.append(100.0 * (close - lo) / (hi - lo))
        ts_list.append(candles[i].ts)

    if len(raw_k) < k_smooth:
        return [], [], []

    k_line = _sma(raw_k, k_smooth)
    d_line = _sma(k_line, d_period)
    if not d_line:
        return [], [], []

    # Align lengths: d_line is shortest
    offset = len(raw_k) - len(d_line)
    k_aligned = k_line[-len(d_line) :]
    ts_aligned = ts_list[-len(d_line) :]
    return k_aligned, d_line, ts_aligned


def _detect_stoch_crosses(
    k_line: list[float],
    d_line: list[float],
    ts_list: list[datetime],
) -> tuple[list[StochSeriesPoint], str | None, datetime | None]:
    series: list[StochSeriesPoint] = []
    last_cross: str | None = None
    last_cross_ts: datetime | None = None

    for i, (k, d, ts) in enumerate(zip(k_line, d_line, ts_list, strict=True)):
        cross: str | None = None
        if i > 0:
            pk, pd = k_line[i - 1], d_line[i - 1]
            if pk <= pd and k > d:
                cross = "gc"
            elif pk >= pd and k < d:
                cross = "dc"
        if cross:
            last_cross = cross
            last_cross_ts = ts
        series.append(
            StochSeriesPoint(
                ts=ts,
                k=round(k, 1),
                d=round(d, 1),
                cross=cross,
            )
        )
    return series, last_cross, last_cross_ts


def _analyze_stochastic(
    k: float | None,
    d: float | None,
    last_cross: str | None,
) -> tuple[str, str, str]:
    """Returns zone, signal_ja, summary_ja (BTC perspective)."""
    if k is None or d is None:
        return "neutral", "様子見", "ストキャスデータが不足しています。"

    if k >= 80:
        zone = "overbought"
    elif k <= 20:
        zone = "oversold"
    else:
        zone = "neutral"

    parts: list[str] = [f"%K {k:.0f}・%D {d:.0f}"]
    if last_cross == "gc":
        parts.append("直近で%Kが%Dを下から上抜け（GC）")
        if zone == "oversold":
            parts.append("売られすぎ圏からの反発シグナルで、ロングのタイミングとして注目です")
        elif k > 80:
            parts.append("買われすぎ圏でのGCのため、押し目確認が必要です")
        else:
            parts.append("上昇モメンタムが改善した局面です")
    elif last_cross == "dc":
        parts.append("直近で%Kが%Dを上から下抜け（DC）")
        if zone == "overbought":
            parts.append("買われすぎ圏からの転換で、ショートのタイミングとして注目です")
        elif k < 20:
            parts.append("売られすぎ圏でのDCのため、追い売りは慎重に")
        else:
            parts.append("下降モメンタムが強まった局面です")
    else:
        if zone == "oversold":
            parts.append("売られすぎ圏。GCを待つとエントリーしやすいです")
        elif zone == "overbought":
            parts.append("買われすぎ圏。DCを待つと戻り売りを検討しやすいです")
        else:
            parts.append("中立圏で、クロスが出るまで様子見が無難です")

    if last_cross == "gc":
        signal = "反発寄り" if zone != "overbought" else "様子見"
    elif last_cross == "dc":
        signal = "戻り売り寄り" if zone != "oversold" else "様子見"
    elif zone == "oversold":
        signal = "売られすぎ"
    elif zone == "overbought":
        signal = "買われすぎ"
    else:
        signal = "様子見"

    return zone, signal, "。".join(parts) + "。"


def _stoch_stance(
    k: float | None,
    d: float | None,
    last_cross: str | None,
    zone: str,
) -> str:
    if k is None:
        return "neutral"
    if last_cross == "gc" and zone == "oversold":
        return "bullish"
    if last_cross == "dc" and zone == "overbought":
        return "bearish"
    if last_cross == "gc" and k < 50:
        return "bullish"
    if last_cross == "dc" and k > 50:
        return "bearish"
    if zone == "overbought" and last_cross != "gc":
        return "bearish"
    if zone == "oversold" and last_cross != "dc":
        return "bullish"
    if last_cross == "gc" or last_cross == "dc":
        return "reversal"
    return "neutral"


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
        atr_14 = _atr(candles)
        price = float(closes[-1])
        overlay_series = _build_overlay_series(candles)

        k_line, d_line, stoch_ts = _stochastic(candles)
        stoch_k = round(k_line[-1], 1) if k_line else None
        stoch_d = round(d_line[-1], 1) if d_line else None
        stoch_series: list[StochSeriesPoint] = []
        last_cross: str | None = None
        last_cross_ts = None
        if k_line and d_line:
            stoch_series, last_cross, last_cross_ts = _detect_stoch_crosses(
                k_line, d_line, stoch_ts
            )
        stoch_zone, stoch_signal_ja, stoch_summary_ja = _analyze_stochastic(
            stoch_k, stoch_d, last_cross
        )
        stoch_stance_val = _stoch_stance(stoch_k, stoch_d, last_cross, stoch_zone)

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

        if last_cross == "gc":
            if stoch_zone == "oversold":
                bullish += 2
            elif stoch_zone != "overbought":
                bullish += 1
        elif last_cross == "dc":
            if stoch_zone == "overbought":
                bearish += 2
            elif stoch_zone != "oversold":
                bearish += 1
        elif stoch_zone == "oversold":
            bullish += 1
        elif stoch_zone == "overbought":
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
        if atr_14 is not None:
            parts.append(f"ATR(14) ${atr_14:,.0f}")
        if stoch_k is not None and stoch_d is not None:
            parts.append(f"Stoch {stoch_signal_ja}")

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
            atr_14=atr_14,
            stoch_k=stoch_k,
            stoch_d=stoch_d,
            stoch_last_cross=last_cross,  # type: ignore[arg-type]
            stoch_last_cross_ts=last_cross_ts,
            stoch_zone=stoch_zone,  # type: ignore[arg-type]
            stoch_signal_ja=stoch_signal_ja,
            stoch_summary_ja=stoch_summary_ja,
            stoch_stance=stoch_stance_val,  # type: ignore[arg-type]
            stoch_series=stoch_series,
            trend=trend,
            summary_ja=summary,
            overlay_series=overlay_series,
        )
