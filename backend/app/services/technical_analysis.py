from __future__ import annotations

import numpy as np

from app.schemas.candles import (
    BollingerValues,
    Candle,
    CandleInterval,
    IchimokuSeriesPoint,
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
    """Wilder's RSI: seed with the first `period` average, then smooth over the series.

    TradingView や一般的なチャートと同じ平滑化方式。単純平均より直近の値動きへの
    追従が安定し、閾値（売られすぎ/買われすぎ）判定の整合性が取れる。
    """
    if len(closes) < period + 1:
        return None
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    # Seed: simple average of the first `period` changes.
    avg_gain = float(np.mean(gains[:period]))
    avg_loss = float(np.mean(losses[:period]))
    # Wilder smoothing for the remaining changes.
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
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


def _adx(candles: list[Candle], period: int = 14) -> float | None:
    """Wilder's ADX(14): trend-strength gauge in [0, 100].

    ADX は方向ではなく「トレンドの強さ」を測る。<20 はレンジ（トレンド追随系の
    シグナルが効きにくい）、>25 は明確なトレンドの目安。シグナル合成の重み付けに使う。
    """
    if len(candles) < period * 2 + 1:
        return None
    highs = [c.high for c in candles]
    lows = [c.low for c in candles]
    closes = [c.close for c in candles]

    plus_dm: list[float] = []
    minus_dm: list[float] = []
    trs: list[float] = []
    for i in range(1, len(candles)):
        up_move = highs[i] - highs[i - 1]
        down_move = lows[i - 1] - lows[i]
        plus_dm.append(up_move if (up_move > down_move and up_move > 0) else 0.0)
        minus_dm.append(down_move if (down_move > up_move and down_move > 0) else 0.0)
        trs.append(
            max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i - 1]),
                abs(lows[i] - closes[i - 1]),
            )
        )
    if len(trs) < period:
        return None

    def _dx(atr_v: float, sm_plus: float, sm_minus: float) -> float:
        if atr_v == 0:
            return 0.0
        plus_di = 100.0 * sm_plus / atr_v
        minus_di = 100.0 * sm_minus / atr_v
        denom = plus_di + minus_di
        if denom == 0:
            return 0.0
        return 100.0 * abs(plus_di - minus_di) / denom

    # Wilder-smoothed running sums of TR / +DM / -DM.
    atr = sum(trs[:period])
    sm_plus = sum(plus_dm[:period])
    sm_minus = sum(minus_dm[:period])
    dx_values: list[float] = [_dx(atr, sm_plus, sm_minus)]
    for i in range(period, len(trs)):
        atr = atr - atr / period + trs[i]
        sm_plus = sm_plus - sm_plus / period + plus_dm[i]
        sm_minus = sm_minus - sm_minus / period + minus_dm[i]
        dx_values.append(_dx(atr, sm_plus, sm_minus))

    if len(dx_values) < period:
        return round(float(dx_values[-1]), 1) if dx_values else None
    adx = sum(dx_values[:period]) / period
    for dx in dx_values[period:]:
        adx = (adx * (period - 1) + dx) / period
    return round(float(adx), 1)


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


def _midpoint(highs: np.ndarray, lows: np.ndarray, end: int, period: int) -> float | None:
    start = end - period + 1
    if start < 0:
        return None
    return float((np.max(highs[start : end + 1]) + np.min(lows[start : end + 1])) / 2)


def _ichimoku(
    candles: list[Candle],
) -> tuple[
    list[IchimokuSeriesPoint],
    float | None,
    float | None,
    float | None,
    float | None,
    str | None,
    str | None,
    int,
]:
    """TradingView-standard Ichimoku (9/26/52, displacement 26)."""
    n = len(candles)
    if n < 52 + 26:
        return [], None, None, None, None, None, None, 0

    highs = np.array([c.high for c in candles], dtype=float)
    lows = np.array([c.low for c in candles], dtype=float)
    closes = np.array([c.close for c in candles], dtype=float)
    displacement = 26

    tenkan = np.full(n, np.nan)
    kijun = np.full(n, np.nan)
    senkou_a = np.full(n, np.nan)
    senkou_b = np.full(n, np.nan)

    for i in range(8, n):
        val = _midpoint(highs, lows, i, 9)
        if val is not None:
            tenkan[i] = val
    for i in range(25, n):
        val = _midpoint(highs, lows, i, 26)
        if val is not None:
            kijun[i] = val
    for i in range(25, n):
        if not np.isnan(tenkan[i]) and not np.isnan(kijun[i]):
            target = i + displacement
            if target < n:
                senkou_a[target] = (tenkan[i] + kijun[i]) / 2
    for i in range(51, n):
        val = _midpoint(highs, lows, i, 52)
        if val is not None:
            target = i + displacement
            if target < n:
                senkou_b[target] = val

    series: list[IchimokuSeriesPoint] = []
    for i, c in enumerate(candles):
        series.append(
            IchimokuSeriesPoint(
                ts=c.ts,
                tenkan=round(float(tenkan[i]), 2) if not np.isnan(tenkan[i]) else None,
                kijun=round(float(kijun[i]), 2) if not np.isnan(kijun[i]) else None,
                senkou_a=round(float(senkou_a[i]), 2) if not np.isnan(senkou_a[i]) else None,
                senkou_b=round(float(senkou_b[i]), 2) if not np.isnan(senkou_b[i]) else None,
            )
        )

    idx = n - 1
    t = float(tenkan[idx]) if not np.isnan(tenkan[idx]) else None
    k = float(kijun[idx]) if not np.isnan(kijun[idx]) else None
    sa = float(senkou_a[idx]) if not np.isnan(senkou_a[idx]) else None
    sb = float(senkou_b[idx]) if not np.isnan(senkou_b[idx]) else None

    price_vs_cloud: str | None = None
    if sa is not None and sb is not None:
        top = max(sa, sb)
        bottom = min(sa, sb)
        if closes[idx] > top:
            price_vs_cloud = "above"
        elif closes[idx] < bottom:
            price_vs_cloud = "below"
        else:
            price_vs_cloud = "inside"

    signal, roles = _ichimoku_sanyaku(
        tenkan_above_kijun=t is not None and k is not None and t > k,
        tenkan_below_kijun=t is not None and k is not None and t < k,
        price_vs_cloud=price_vs_cloud,
        chikou_bullish=idx >= 26 and closes[idx] > closes[idx - 26],
        chikou_bearish=idx >= 26 and closes[idx] < closes[idx - 26],
    )
    return series, t, k, sa, sb, price_vs_cloud, signal, roles


def _ichimoku_sanyaku(
    *,
    tenkan_above_kijun: bool,
    tenkan_below_kijun: bool,
    price_vs_cloud: str | None,
    chikou_bullish: bool,
    chikou_bearish: bool,
) -> tuple[str | None, int]:
    bull_roles = 0
    bear_roles = 0
    if tenkan_above_kijun:
        bull_roles += 1
    if tenkan_below_kijun:
        bear_roles += 1
    if price_vs_cloud == "above":
        bull_roles += 1
    elif price_vs_cloud == "below":
        bear_roles += 1
    if chikou_bullish:
        bull_roles += 1
    elif chikou_bearish:
        bear_roles += 1

    if bull_roles == 3:
        return "sanyaku_kouten", 3
    if bear_roles == 3:
        return "sanyaku_gyakuten", 3
    return None, max(bull_roles, bear_roles)


def _analyze_ichimoku(
    *,
    tenkan: float | None,
    kijun: float | None,
    senkou_a: float | None,
    senkou_b: float | None,
    price_vs_cloud: str | None,
    signal: str | None,
    roles_met: int,
    price: float,
) -> tuple[str, str, str]:
    if tenkan is None or kijun is None:
        return "neutral", "様子見", "一目均衡表の計算に十分なローソク足がありません。"

    parts: list[str] = [
        f"転換線 ${tenkan:,.0f}・基準線 ${kijun:,.0f}",
    ]
    if senkou_a is not None and senkou_b is not None:
        top = max(senkou_a, senkou_b)
        bottom = min(senkou_a, senkou_b)
        parts.append(f"雲 ${bottom:,.0f}〜${top:,.0f}")
    if price_vs_cloud == "above":
        parts.append("価格は雲の上")
    elif price_vs_cloud == "below":
        parts.append("価格は雲の下")
    elif price_vs_cloud == "inside":
        parts.append("価格は雲の中")

    if signal == "sanyaku_kouten":
        parts.append("三役好転（転換線＞基準線・雲上・遅行が価格上）で買い環境")
        return "bullish", "上昇支援", "。".join(parts) + "。"
    if signal == "sanyaku_gyakuten":
        parts.append("三役逆転（転換線＜基準線・雲下・遅行が価格下）で売り環境")
        return "bearish", "下落の症候", "。".join(parts) + "。"

    if roles_met == 2:
        if tenkan > kijun and price_vs_cloud == "above":
            parts.append("好転要素が2つ。三役好転まであと1つ")
            return "caution", "様子見", "。".join(parts) + "。"
        if tenkan < kijun and price_vs_cloud == "below":
            parts.append("逆転要素が2つ。三役逆転まであと1つ")
            return "caution", "様子見", "。".join(parts) + "。"

    if tenkan > kijun:
        parts.append("転換線が基準線より上で短期は強気寄り")
    elif tenkan < kijun:
        parts.append("転換線が基準線より下で短期は弱気寄り")
    else:
        parts.append("転換線と基準線が拮抗")
    return "neutral", "様子見", "。".join(parts) + "。"


def _ichimoku_stance(signal: str | None, stance_from_analyze: str) -> str:
    if signal == "sanyaku_kouten":
        return "bullish"
    if signal == "sanyaku_gyakuten":
        return "bearish"
    return stance_from_analyze


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


def _combine_signals(
    *,
    price: float,
    rsi: float | None,
    ema20: float | None,
    ema50: float | None,
    ema200: float | None,
    macd: MacdValues | None,
    bollinger: BollingerValues | None,
    adx: float | None,
    last_cross: str | None,
    stoch_zone: str,
    ichimoku_signal: str | None = None,
) -> tuple[str, float, float]:
    """Weighted, regime-aware signal combination → (trend, bull_score, bear_score).

    旧実装（指標ごとに等重み +1、Stoch のみ +2 の単純多数決）の問題を解消する:
    - 相関するトレンド系（EMA20/50 と 価格 vs EMA200）を1つのトレンドスコアに統合し、
      トレンドの二重カウントを排除。
    - ADX でレジームを判定し、順張り（トレンド系）と逆張り（RSI/BB/Stoch）の重みを
      切り替える。レンジ時は順張りを弱め逆張りを強め、トレンド時はその逆。
    - RSI はグラデーション（30/40・60/70）で寄与を段階化。
    - Stochastic はタイミング系として軽量化（最大 0.8、旧実装の最大 2 から低減）。
    - 中立マージンを設け、僅差では neutral を返してダマシを抑制。
    """
    bull = 0.0
    bear = 0.0

    trending = adx is not None and adx >= 25
    ranging = adx is not None and adx < 20
    trend_w = 1.5 if trending else 0.6 if ranging else 1.0
    mr_w = 0.6 if trending else 1.2 if ranging else 1.0  # mean-reversion weight

    # --- Trend group: combine EMA structure into a single score in [-2, 2] ---
    trend_score = 0
    if ema20 is not None and ema50 is not None:
        trend_score += 1 if ema20 > ema50 else -1
    if ema200 is not None:
        trend_score += 1 if price > ema200 else -1
    if trend_score > 0:
        bull += trend_w * (trend_score / 2)
    elif trend_score < 0:
        bear += trend_w * (-trend_score / 2)

    # --- Momentum: MACD histogram ---
    if macd is not None:
        if macd.histogram > 0:
            bull += 1.0
        elif macd.histogram < 0:
            bear += 1.0

    # --- Mean reversion: RSI with gradient ---
    if rsi is not None:
        if rsi < 30:
            bull += mr_w
        elif rsi < 40:
            bull += mr_w * 0.5
        elif rsi > 70:
            bear += mr_w
        elif rsi > 60:
            bear += mr_w * 0.5

    # --- Mean reversion: Bollinger band touch ---
    if bollinger is not None:
        if price <= bollinger.lower:
            bull += mr_w * 0.8
        elif price >= bollinger.upper:
            bear += mr_w * 0.8

    # --- Timing: Stochastic (light, capped weight) ---
    stoch_w = 0.8
    if last_cross == "gc":
        if stoch_zone == "oversold":
            bull += stoch_w
        elif stoch_zone != "overbought":
            bull += stoch_w * 0.5
    elif last_cross == "dc":
        if stoch_zone == "overbought":
            bear += stoch_w
        elif stoch_zone != "oversold":
            bear += stoch_w * 0.5
    elif stoch_zone == "oversold":
        bull += stoch_w * 0.5
    elif stoch_zone == "overbought":
        bear += stoch_w * 0.5

    if ichimoku_signal == "sanyaku_kouten":
        bull += 1.5
    elif ichimoku_signal == "sanyaku_gyakuten":
        bear += 1.5

    margin = 0.5
    if bull - bear > margin:
        trend = "bullish"
    elif bear - bull > margin:
        trend = "bearish"
    else:
        trend = "neutral"
    return trend, round(bull, 2), round(bear, 2)


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
        adx_14 = _adx(candles)
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

        ich_series, i_tenkan, i_kijun, i_sa, i_sb, i_cloud, i_signal, i_roles = _ichimoku(
            candles
        )
        i_cloud_top = None
        i_cloud_bottom = None
        if i_sa is not None and i_sb is not None:
            i_cloud_top = round(max(i_sa, i_sb), 2)
            i_cloud_bottom = round(min(i_sa, i_sb), 2)
        i_stance_raw, i_signal_ja, i_summary_ja = _analyze_ichimoku(
            tenkan=i_tenkan,
            kijun=i_kijun,
            senkou_a=i_sa,
            senkou_b=i_sb,
            price_vs_cloud=i_cloud,
            signal=i_signal,
            roles_met=i_roles,
            price=price,
        )
        ichimoku_stance_val = _ichimoku_stance(i_signal, i_stance_raw)

        trend, _bull_score, _bear_score = _combine_signals(
            price=price,
            rsi=rsi,
            ema20=ema20,
            ema50=ema50,
            ema200=ema200,
            macd=macd,
            bollinger=bollinger,
            adx=adx_14,
            last_cross=last_cross,
            stoch_zone=stoch_zone,
            ichimoku_signal=i_signal,
        )

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
        if adx_14 is not None:
            regime = "強いトレンド" if adx_14 >= 25 else "レンジ" if adx_14 < 20 else "トレンド形成中"
            parts.append(f"ADX(14) {adx_14:.0f}（{regime}）")
        if stoch_k is not None and stoch_d is not None:
            parts.append(f"Stoch {stoch_signal_ja}")
        if i_signal_ja:
            parts.append(f"Ichimoku {i_signal_ja}")

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
            adx_14=adx_14,
            stoch_k=stoch_k,
            stoch_d=stoch_d,
            stoch_last_cross=last_cross,  # type: ignore[arg-type]
            stoch_last_cross_ts=last_cross_ts,
            stoch_zone=stoch_zone,  # type: ignore[arg-type]
            stoch_signal_ja=stoch_signal_ja,
            stoch_summary_ja=stoch_summary_ja,
            stoch_stance=stoch_stance_val,  # type: ignore[arg-type]
            stoch_series=stoch_series,
            ichimoku_tenkan=round(i_tenkan, 2) if i_tenkan is not None else None,
            ichimoku_kijun=round(i_kijun, 2) if i_kijun is not None else None,
            ichimoku_senkou_a=round(i_sa, 2) if i_sa is not None else None,
            ichimoku_senkou_b=round(i_sb, 2) if i_sb is not None else None,
            ichimoku_cloud_top=i_cloud_top,
            ichimoku_cloud_bottom=i_cloud_bottom,
            ichimoku_price_vs_cloud=i_cloud,  # type: ignore[arg-type]
            ichimoku_signal=i_signal,  # type: ignore[arg-type]
            ichimoku_signal_ja=i_signal_ja,
            ichimoku_summary_ja=i_summary_ja,
            ichimoku_stance=ichimoku_stance_val,  # type: ignore[arg-type]
            ichimoku_roles_met=i_roles,
            ichimoku_series=ich_series,
            trend=trend,
            summary_ja=summary,
            overlay_series=overlay_series,
        )
